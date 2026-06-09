import { Prisma } from "@prisma/client";
import type { Booking, BookingSlot } from "@prisma/client";
import { db } from "@/infrastructure/db/client";
import { bus } from "@/infrastructure/realtime/bus";
import { ok, err, ErrCode, type Result } from "@/shared/result";
import { CIRCUIT_BREAK_RATIO, resolveInstantCapacity } from "@/shared/lib/capacity";
import {
  QR_PREFIX,
  isCurrentSlotValid,
  rotatingCode,
  verifyRotatingCode,
  otpSecondsRemaining,
  OTP_STEP_SECONDS,
} from "../domain/rules";

export type CheckinResult = {
  bookingId:   string;
  slotId:      string;
  checkedInAt: Date;
};

export type CheckinCode = {
  otp:              string;
  periodSeconds:    number;
  secondsRemaining: number;
  bookingRef:       string;
  textCode:         string;
};

type CheckinEventPayload = {
  slotId:         string;
  checkedInCount: number; // 全园在园人数(当日各时段之和,口径统一后)
  capacity:       number; // 瞬时承载量(park.instant_capacity)
  circuitBroken:  boolean;
};

type BookingWithSlot = Booking & { slot: BookingSlot };

function cnDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export const checkinService = {
  // 旧固件兼容:静态 qrCode 直接核销
  async checkin(qrCode: string, checkedInBy?: string): Promise<Result<CheckinResult>> {
    if (!qrCode.startsWith(QR_PREFIX)) {
      return err(ErrCode.INVALID_INPUT, "二维码格式无效");
    }
    const booking = await db.booking.findUnique({ where: { qrCode }, include: { slot: true } });
    if (!booking) return err(ErrCode.NOT_FOUND, "预约单不存在");
    return idempotentCheckin(booking, checkedInBy);
  },

  // 新闸机:bookingRef + 30s 动态 OTP 核销(展示码与核销主键解耦)
  async checkinByOtp(
    input: { bookingRef: string; otp: string },
    checkedInBy?: string,
  ): Promise<Result<CheckinResult>> {
    const bookingRef = (input.bookingRef ?? "").trim();
    const otp = (input.otp ?? "").trim();
    if (!bookingRef || !otp) return err(ErrCode.INVALID_INPUT, "缺少核销凭证");

    const booking = await db.booking.findUnique({ where: { id: bookingRef }, include: { slot: true } });
    if (!booking) return err(ErrCode.NOT_FOUND, "预约单不存在");
    if (!verifyRotatingCode(booking.qrSecret, otp, Date.now())) {
      return err(ErrCode.INVALID_INPUT, "核销码无效或已过期，请出示实时码");
    }
    return idempotentCheckin(booking, checkedInBy);
  },

  // C 端:返回当前 OTP(校验归属在路由层),不返回 qrSecret/qrCode
  async getCurrentCheckinCode(bookingId: string, idCard: string): Promise<Result<CheckinCode>> {
    const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { slot: true } });
    if (!booking) return err(ErrCode.NOT_FOUND, "预约单不存在");
    if (booking.idCard !== idCard) return err(ErrCode.PERMISSION_DENIED, "无权查看该预约核销码");
    if (booking.status !== "CONFIRMED") {
      return err(
        ErrCode.INVALID_INPUT,
        booking.status === "CHECKED_IN" ? "该预约已核销" : "该预约状态不可核销",
      );
    }
    const now = Date.now();
    const otp = rotatingCode(booking.qrSecret, now);
    // 离线降级文本码:用稳定的短编号(取 booking id 前 6 位,大写),断网时长期可读、可人工核对
    // 不含动态 OTP(否则 30s 后失效,人工核销形同虚设),也不含任何密钥
    const stableRef = booking.id.replace(/-/g, "").slice(0, 6).toUpperCase();
    return ok({
      otp,
      periodSeconds: OTP_STEP_SECONDS,
      secondsRemaining: otpSecondsRemaining(now),
      bookingRef: booking.id,
      textCode: `长秋山-${cnDate(booking.slot.date)}-${stableRef}`,
    });
  },
};

// 现有幂等核销事务原封不动:UPDATE WHERE status='CONFIRMED' + checkin_log ON CONFLICT DO NOTHING
//   + booking_slot.checked_in_count+1 + bus 发 checkin_event(90% 熔断代理)
async function idempotentCheckin(
  booking: BookingWithSlot,
  checkedInBy?: string,
): Promise<Result<CheckinResult>> {
  const bookingId = booking.id;
  const now = new Date();

  if (!isCurrentSlotValid(booking, booking.slot, now)) {
    if (booking.status !== "CONFIRMED") {
      return err(
        ErrCode.CHECKIN_ALREADY_DONE,
        booking.status === "CHECKED_IN" ? "该预约已核销" : "预约单状态不允许核销",
      );
    }
    return err(ErrCode.INVALID_INPUT, "当前不在该时段的核销时间窗口内");
  }

  const result = await db.$transaction(async (tx) => {
    const affected = await tx.$executeRaw(Prisma.sql`
      UPDATE booking
      SET    status        = 'CHECKED_IN'::"BookingStatus",
             checked_in_at = ${now},
             updated_at    = NOW()
      WHERE  id     = ${bookingId}::uuid
        AND  status = 'CONFIRMED'::"BookingStatus"
    `);
    if (affected === 0) return null;

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO checkin_log (id, booking_id, checked_in_at, checked_in_by, slot_id, created_at)
      VALUES (
        gen_random_uuid(),
        ${bookingId}::uuid,
        ${now},
        ${checkedInBy ?? null}::uuid,
        ${booking.slotId}::uuid,
        NOW()
      )
      ON CONFLICT (booking_id) DO NOTHING
    `);

    const [slotRow] = await tx.$queryRaw<[{ checked_in_count: bigint; capacity: number }]>(Prisma.sql`
      UPDATE booking_slot
      SET    checked_in_count = checked_in_count + 1,
             updated_at       = NOW()
      WHERE  id = ${booking.slotId}::uuid
      RETURNING checked_in_count, capacity
    `);

    return slotRow;
  });

  if (!result) {
    return err(ErrCode.CHECKIN_ALREADY_DONE, "该预约已核销，请勿重复操作");
  }

  // 红线4 口径统一:分子=当日全园在园人数(各时段 checked_in_count 之和),分母=瞬时承载量
  // (park.instant_capacity)。直读 system_config(与本函数已有的跨表 raw SQL 同模式,避免 import
  // booking/system 模块破 eslint-boundaries);缺配/非法走 env→默认兜底(resolveInstantCapacity)。
  const [parkRow] = await db.$queryRaw<[{ in_park: number }]>(Prisma.sql`
    SELECT COALESCE(SUM(checked_in_count), 0)::int AS in_park
    FROM booking_slot
    WHERE date = (SELECT date FROM booking_slot WHERE id = ${booking.slotId}::uuid)
  `);
  const inPark = parkRow?.in_park ?? 0;
  const capRows = await db.$queryRaw<{ value: string }[]>(Prisma.sql`
    SELECT value FROM system_config WHERE key = 'park.instant_capacity' LIMIT 1
  `);
  const instantCapacity = resolveInstantCapacity(capRows[0]?.value);
  const circuitBroken = instantCapacity > 0 && inPark / instantCapacity >= CIRCUIT_BREAK_RATIO;

  bus.publish("checkin_event", {
    slotId: booking.slotId,
    checkedInCount: inPark,       // 口径统一:全园在园人数(非单时段)
    capacity: instantCapacity,    // 口径统一:瞬时承载量(非单时段 capacity)
    circuitBroken,
  } as CheckinEventPayload);

  // 熔断(红线4)内联:达 90% 立即暂停当日所有 ACTIVE 时段。
  // 原放在 instrumentation 的 bus 监听,但 Vercel serverless 无常驻进程/跨实例 bus →
  // 改到核销写路径内联,自托管与 serverless 都成立(幂等)。
  // 直接 raw SQL(与本函数已有的 booking_slot 写一致),按 slotId 子查询取同日,
  // 避免 import booking 模块(eslint-boundaries 禁模块互依)与日期类型时区来回解析。
  if (circuitBroken) {
    await db.$executeRaw(Prisma.sql`
      UPDATE booking_slot
      SET    status = 'PAUSED'::"BookingSlotStatus", updated_at = NOW()
      WHERE  status = 'ACTIVE'::"BookingSlotStatus"
        AND  date = (SELECT date FROM booking_slot WHERE id = ${booking.slotId}::uuid)
    `).catch((e: unknown) => {
      console.error("[checkin] circuit-break inline pause failed", e);
    });
  }

  return ok({ bookingId, slotId: booking.slotId, checkedInAt: now });
}

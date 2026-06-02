import { Prisma } from "@prisma/client";
import { db } from "@/infrastructure/db/client";
import { bus } from "@/infrastructure/realtime/bus";
import { ok, err, ErrCode, type Result } from "@/shared/result";
import { QR_PREFIX, isCurrentSlotValid } from "../domain/rules";

export type CheckinResult = {
  bookingId:   string;
  slotId:      string;
  checkedInAt: Date;
};

type CheckinEventPayload = {
  slotId:         string;
  checkedInCount: number;
  capacity:       number;
  circuitBroken:  boolean;
};

export const checkinService = {
  async checkin(qrCode: string, checkedInBy?: string): Promise<Result<CheckinResult>> {
    if (!qrCode.startsWith(QR_PREFIX)) {
      return err(ErrCode.INVALID_INPUT, "二维码格式无效");
    }
    const bookingId = qrCode.slice(QR_PREFIX.length);

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { slot: true },
    });
    if (!booking) return err(ErrCode.NOT_FOUND, "预约单不存在");

    const now = new Date();
    if (!isCurrentSlotValid(booking, booking.slot, now)) {
      if (booking.status !== "CONFIRMED") {
        return err(ErrCode.CHECKIN_ALREADY_DONE, booking.status === "CHECKED_IN" ? "该预约已核销" : "预约单状态不允许核销");
      }
      return err(ErrCode.INVALID_INPUT, "当前不在该时段的核销时间窗口内");
    }

    // N8: 幂等原子更新 — 零行即幂等命中
    const affected = await db.$executeRaw(Prisma.sql`
      UPDATE booking
      SET    status        = 'CHECKED_IN'::"BookingStatus",
             checked_in_at = NOW(),
             updated_at    = NOW()
      WHERE  id     = ${bookingId}::uuid
        AND  status = 'CONFIRMED'::"BookingStatus"
    `);
    if (affected === 0) return err(ErrCode.CHECKIN_ALREADY_DONE, "该预约已核销，请勿重复操作");

    // 写 checkin_log（ON CONFLICT DO NOTHING 双重幂等保障）
    await db.$executeRaw(Prisma.sql`
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

    // 在园计数原子 +1，取回最新值
    const [slotRow] = await db.$queryRaw<[{ checked_in_count: bigint; capacity: number }]>(Prisma.sql`
      UPDATE booking_slot
      SET    checked_in_count = checked_in_count + 1,
             updated_at       = NOW()
      WHERE  id = ${booking.slotId}::uuid
      RETURNING checked_in_count, capacity
    `);

    const checkedInCount = Number(slotRow.checked_in_count);
    const circuitBroken  = slotRow.capacity > 0 && checkedInCount / slotRow.capacity >= 0.9;

    const payload: CheckinEventPayload = {
      slotId: booking.slotId, checkedInCount, capacity: slotRow.capacity, circuitBroken,
    };
    bus.publish("checkin_event", payload);

    return ok({ bookingId, slotId: booking.slotId, checkedInAt: now });
  },
};

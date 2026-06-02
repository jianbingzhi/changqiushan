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

    // C1 Fix: 用 qrCode 字段查询(qrCode 是随机 hex,不是 UUID)
    const booking = await db.booking.findUnique({
      where: { qrCode },
      include: { slot: true },
    });
    if (!booking) return err(ErrCode.NOT_FOUND, "预约单不存在");

    const bookingId = booking.id;
    const now = new Date();

    if (!isCurrentSlotValid(booking, booking.slot, now)) {
      if (booking.status !== "CONFIRMED") {
        return err(ErrCode.CHECKIN_ALREADY_DONE, booking.status === "CHECKED_IN" ? "该预约已核销" : "预约单状态不允许核销");
      }
      return err(ErrCode.INVALID_INPUT, "当前不在该时段的核销时间窗口内");
    }

    // H1 Fix: 三步操作包进事务，防止 booking 已 CHECKED_IN 但计数器未增
    const result = await db.$transaction(async (tx) => {
      // N8: 幂等原子更新
      const affected = await tx.$executeRaw(Prisma.sql`
        UPDATE booking
        SET    status        = 'CHECKED_IN'::"BookingStatus",
               checked_in_at = ${now},
               updated_at    = NOW()
        WHERE  id     = ${bookingId}::uuid
          AND  status = 'CONFIRMED'::"BookingStatus"
      `);
      if (affected === 0) return null; // 已核销，事务中止

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

    const checkedInCount = Number(result.checked_in_count);
    const circuitBroken  = result.capacity > 0 && checkedInCount / result.capacity >= 0.9;

    bus.publish("checkin_event", {
      slotId: booking.slotId, checkedInCount, capacity: result.capacity, circuitBroken,
    } as CheckinEventPayload);

    return ok({ bookingId, slotId: booking.slotId, checkedInAt: now });
  },
};

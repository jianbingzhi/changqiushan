import { Prisma } from "@prisma/client";
import type { BookingChannel, Booking, BookingSlot } from "@prisma/client";
import { db } from "@/infrastructure/db/client";
import { randomBytes } from "crypto";

type CreateBookingData = {
  slotId: string;
  visitorName: string;
  idCard: string;
  phone: string;
  plate?: string;
  noVehicleDeclared: boolean;
  channel: BookingChannel;
};

// Maps BookingChannel → snake_case column prefix in booking_slot
const CHANNEL_COL: Record<BookingChannel, string> = {
  MINI_PROGRAM:  "mini_program",
  ONSITE_MAKEUP: "onsite",
  OTA:           "ota",
  ADMIN_MANUAL:  "admin",
};

export class SlotFullError extends Error {
  constructor() {
    super("slot_full");
    this.name = "SlotFullError";
  }
}

export const bookingRepository = {
  listSlotsByDate(date: Date): Promise<BookingSlot[]> {
    return db.bookingSlot.findMany({
      where: { date },
      orderBy: { startTime: "asc" },
    });
  },

  getSlot(id: string): Promise<BookingSlot | null> {
    return db.bookingSlot.findUnique({ where: { id } });
  },

  getBookingWithSlot(id: string) {
    return db.booking.findUnique({
      where: { id },
      include: { slot: true },
    });
  },

  countDailyBookings(idCard: string, date: Date): Promise<number> {
    return db.booking.count({
      where: { idCard, status: "CONFIRMED", slot: { date } },
    });
  },

  async createBookingOptimistic(data: CreateBookingData): Promise<Booking> {
    const col = CHANNEL_COL[data.channel];
    const qrCode = "bk-" + randomBytes(29).toString("hex");

    return db.$transaction(async (tx) => {
      // Atomic per-channel counter increment with quota guard.
      // affected=0 means slot full or status!=ACTIVE (concurrent conflict).
      const affected = await tx.$executeRaw(Prisma.sql`
        UPDATE booking_slot
        SET ${Prisma.raw(`"${col}_booked"`)} = ${Prisma.raw(`"${col}_booked"`)} + 1,
            booked_count = booked_count + 1,
            updated_at = NOW()
        WHERE id = ${data.slotId}::uuid
          AND status = 'ACTIVE'::"BookingSlotStatus"
          AND ${Prisma.raw(`"${col}_booked"`)} + 1 <= ${Prisma.raw(`"${col}_quota"`)}
      `);

      if (affected === 0) throw new SlotFullError();

      return tx.booking.create({
        data: {
          slotId: data.slotId,
          visitorName: data.visitorName,
          idCard: data.idCard,
          phone: data.phone,
          plate: data.plate ?? null,
          noVehicleDeclared: data.noVehicleDeclared,
          channel: data.channel,
          qrCode,
        },
      });
    });
  },

  async cancelBooking(bookingId: string): Promise<void> {
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const col = CHANNEL_COL[booking.channel];

    await db.$transaction(async (tx) => {
      // H2 Fix: WHERE status='CONFIRMED' 防止并发取消双重扣减
      const affected = await tx.$executeRaw(Prisma.sql`
        UPDATE booking
        SET    status       = 'CANCELLED'::"BookingStatus",
               cancelled_at = NOW(),
               updated_at   = NOW()
        WHERE  id     = ${bookingId}::uuid
          AND  status = 'CONFIRMED'::"BookingStatus"
      `);
      if (affected === 0) return; // 已取消或状态变更,幂等退出

      await tx.$executeRaw(Prisma.sql`
        UPDATE booking_slot
        SET ${Prisma.raw(`"${col}_booked"`)} = GREATEST(0, ${Prisma.raw(`"${col}_booked"`)} - 1),
            booked_count = GREATEST(0, booked_count - 1),
            updated_at = NOW()
        WHERE id = ${booking.slotId}::uuid
      `);
    });
  },

  pauseSlotsForCircuitBreak(date: Date): Promise<Prisma.BatchPayload> {
    return db.bookingSlot.updateMany({
      where: { date, status: "ACTIVE" },
      data: { status: "PAUSED" },
    });
  },

  resumePausedSlots(date: Date): Promise<Prisma.BatchPayload> {
    return db.bookingSlot.updateMany({
      where: { date, status: "PAUSED" },
      data: { status: "ACTIVE" },
    });
  },

  getCheckedInCount(slotId: string) {
    return db.bookingSlot.findUniqueOrThrow({
      where: { id: slotId },
      select: { checkedInCount: true },
    });
  },

  countBookings() {
    return db.booking.count();
  },
};

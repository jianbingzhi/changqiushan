import type { Booking, BookingSlot } from "@prisma/client";

export const QR_PREFIX = "bk-";

export function isCurrentSlotValid(booking: Booking, slot: BookingSlot, now: Date): boolean {
  if (booking.status !== "CONFIRMED") return false;
  const dateStr = slot.date.toISOString().slice(0, 10);
  const start = new Date(`${dateStr}T${slot.startTime}:00+08:00`);
  const end   = new Date(`${dateStr}T${slot.endTime}:00+08:00`);
  return now >= start && now <= end;
}

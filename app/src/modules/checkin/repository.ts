import { Prisma } from "@prisma/client";
import { db } from "@/infrastructure/db/client";

export const checkinRepository = {
  findBookingWithSlot(id: string) {
    return db.booking.findUnique({
      where: { id },
      include: { slot: true },
    });
  },

  // N8: 幂等核销 — UPDATE ... WHERE status='CONFIRMED', 零行=已核销
  async markCheckedIn(bookingId: string): Promise<{ affected: number; checkedInAt: Date }> {
    const now = new Date();
    const affected = await db.$executeRaw(Prisma.sql`
      UPDATE booking
      SET status = 'CHECKED_IN'::"BookingStatus",
          checked_in_at = ${now},
          updated_at = NOW()
      WHERE id = ${bookingId}::uuid
        AND status = 'CONFIRMED'::"BookingStatus"
    `);
    return { affected, checkedInAt: now };
  },

  async incrementCheckedInCount(slotId: string): Promise<number> {
    const result = await db.$executeRaw(Prisma.sql`
      UPDATE booking_slot
      SET checked_in_count = checked_in_count + 1,
          updated_at = NOW()
      WHERE id = ${slotId}::uuid
      RETURNING checked_in_count
    `);
    void result;
    // Return the updated count via findUnique
    const slot = await db.bookingSlot.findUniqueOrThrow({
      where: { id: slotId },
      select: { checkedInCount: true },
    });
    return slot.checkedInCount;
  },

  createCheckinLog(data: {
    bookingId: string;
    slotId: string;
    checkedInAt: Date;
    checkedInBy?: string;
  }) {
    return db.checkinLog.create({ data });
  },
};

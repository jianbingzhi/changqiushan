import { db } from "@/infrastructure/db/client";

export const bookingRepository = {
  listSlotsByDate(date: Date) {
    return db.bookingSlot.findMany({
      where: { date },
      orderBy: { startTime: "asc" },
    });
  },

  getSlot(id: string) {
    return db.bookingSlot.findUnique({ where: { id } });
  },

  countBookings() {
    return db.booking.count();
  },
};

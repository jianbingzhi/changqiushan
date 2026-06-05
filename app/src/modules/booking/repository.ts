import { Prisma } from "@prisma/client";
import type { BookingChannel, BookingStatus, Booking, BookingSlot } from "@prisma/client";
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

// E4: DB 部分唯一索引(同证同日)拦截到的并发重复预约
export class DuplicateBookingError extends Error {
  constructor() {
    super("duplicate_booking");
    this.name = "DuplicateBookingError";
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
    // 动态核销码派生密钥(永不下发);展示码由其派生 30s 滚动 TOTP
    const qrSecret = randomBytes(32).toString("hex");

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

      try {
        return await tx.booking.create({
          data: {
            slotId: data.slotId,
            visitorName: data.visitorName,
            idCard: data.idCard,
            phone: data.phone,
            plate: data.plate ?? null,
            noVehicleDeclared: data.noVehicleDeclared,
            channel: data.channel,
            qrCode,
            qrSecret,
          },
        });
      } catch (e) {
        // E4: 触发部分唯一索引 → P2002,事务回滚(已加的渠道计数一并回退)
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new DuplicateBookingError();
        }
        throw e;
      }
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

  // B22: 预约单查询 — 按身份证/手机号(模糊)+ 状态过滤,含时段,倒序,限 200
  listBookings(filter: { idCard?: string; phone?: string; status?: BookingStatus }) {
    return db.booking.findMany({
      where: {
        idCard: filter.idCard ? { contains: filter.idCard } : undefined,
        phone: filter.phone ? { contains: filter.phone } : undefined,
        status: filter.status,
      },
      include: { slot: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  },

  // C 端「我的预约」— 精确 idCard 匹配(防枚举越权),过滤主体永远取 token 绑定值
  listBookingsByIdCardExact(idCard: string) {
    return db.booking.findMany({
      where: { idCard },
      include: { slot: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  },

  // C 端「我的中心」只读聚合:待履约(CONFIRMED)/已核销/爽约/已取消
  async getVisitorStats(idCard: string) {
    const rows = await db.booking.groupBy({
      by: ["status"],
      where: { idCard },
      _count: { _all: true },
    });
    const map = new Map<BookingStatus, number>();
    for (const r of rows) map.set(r.status, r._count._all);
    const pending = map.get("CONFIRMED") ?? 0;
    const checkedIn = map.get("CHECKED_IN") ?? 0;
    const noShow = map.get("NO_SHOW") ?? 0;
    const cancelled = map.get("CANCELLED") ?? 0;
    const expired = map.get("EXPIRED") ?? 0;
    return {
      pending,
      checkedIn,
      noShow,
      cancelled,
      total: pending + checkedIn + noShow + cancelled + expired,
    };
  },
};

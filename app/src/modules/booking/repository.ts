import { Prisma } from "@prisma/client";
import type { BookingChannel, BookingStatus, BookingSlotStatus, Booking, BookingSlot } from "@prisma/client";
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

// B32: 预约单列表/计数共用的过滤条件,保证分页 total 与 items 口径一致
export type BookingListFilter = { idCard?: string; phone?: string; status?: BookingStatus };

function bookingWhere(filter: BookingListFilter): Prisma.BookingWhereInput {
  return {
    idCard: filter.idCard ? { contains: filter.idCard } : undefined,
    phone: filter.phone ? { contains: filter.phone } : undefined,
    status: filter.status,
  };
}

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

// B26: 物化时取行后发现非 ACTIVE(并发被熔断暂停/关闭)
export class SlotInactiveError extends Error {
  constructor() {
    super("slot_inactive");
    this.name = "SlotInactiveError";
  }
}

// B31 防黄牛:每日总库存售罄
export class DailyStockExhaustedError extends Error {
  constructor() {
    super("daily_stock_exhausted");
    this.name = "DailyStockExhaustedError";
  }
}

// B31 防黄牛:单手机号当日预约达上限
export class PhoneLimitError extends Error {
  constructor() {
    super("phone_limit_reached");
    this.name = "PhoneLimitError";
  }
}

// B31 防黄牛:单身份证当日预约达上限(N>1 计数路径;N=1 由部分唯一索引拦截)
export class IdCardLimitError extends Error {
  constructor() {
    super("idcard_limit_reached");
    this.name = "IdCardLimitError";
  }
}

// B31 下单时注入的防黄牛阈值(由 app 路由层从 configService 读出)。默认不限/1。
export type BookingLimits = {
  dailyTotalStock: number; // 0=不限
  perIdCard:       number; // 默认 1
  perPhone:        number; // 0=不限
};

// B26: 首单惰性物化所需的权威时段定义(一律来自服务端派生,绝不信前端)
export type SlotDefinition = {
  id:               string;
  date:             Date;
  name:             string;
  startTime:        string;
  endTime:          string;
  miniProgramQuota: number;
  onsiteQuota:      number;
  otaQuota:         number;
  adminQuota:       number;
};

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

  // B31 resolveMonth:取某区间(整月)已物化时段,供日历合并真实占用
  listSlotsInRange(from: Date, to: Date): Promise<BookingSlot[]> {
    return db.bookingSlot.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
  },

  // C4:建单个时段。capacity 由各渠道配额之和派生,与 seed 口径一致。
  createSlot(data: {
    date: Date;
    name: string;
    startTime: string;
    endTime: string;
    miniProgramQuota: number;
    onsiteQuota: number;
    otaQuota: number;
    adminQuota: number;
  }): Promise<BookingSlot> {
    const capacity =
      data.miniProgramQuota + data.onsiteQuota + data.otaQuota + data.adminQuota;
    return db.bookingSlot.create({
      data: {
        date: data.date,
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
        capacity,
        miniProgramQuota: data.miniProgramQuota,
        onsiteQuota: data.onsiteQuota,
        otaQuota: data.otaQuota,
        adminQuota: data.adminQuota,
        status: "ACTIVE",
      },
    });
  },

  // C4:批量建时段(复制场景),已存在的开始时间由调用方先行过滤。已用量一律归零。
  createManySlots(
    rows: Prisma.BookingSlotCreateManyInput[],
  ): Promise<number> {
    return db.bookingSlot.createMany({ data: rows }).then((r) => r.count);
  },

  // BE-A3:幂等批量建时段。skipDuplicates → ON CONFLICT (date,start_time) DO NOTHING,
  // 重复跑 cron + 与手动建时段共存安全;绝不 UPDATE 已存在时段(免冲掉运营手调)。
  createManySlotsIdempotent(
    rows: Prisma.BookingSlotCreateManyInput[],
  ): Promise<number> {
    return db.bookingSlot
      .createMany({ data: rows, skipDuplicates: true })
      .then((r) => r.count);
  },

  // BE-A2 时段模板 CRUD
  listSlotTemplates() {
    return db.sysSlotTemplate.findMany({ orderBy: [{ dayType: "asc" }, { startTime: "asc" }] });
  },

  listEnabledTemplates() {
    return db.sysSlotTemplate.findMany({ where: { enabled: true } });
  },

  createSlotTemplate(data: Prisma.SysSlotTemplateCreateInput) {
    return db.sysSlotTemplate.create({ data });
  },

  updateSlotTemplate(id: string, data: Prisma.SysSlotTemplateUpdateInput) {
    return db.sysSlotTemplate.update({ where: { id }, data });
  },

  deleteSlotTemplate(id: string) {
    return db.sysSlotTemplate.delete({ where: { id } });
  },

  // BE-A2 节假日日历(主键即日期 → upsert)
  listHolidayCalendar(from: Date, to: Date) {
    return db.sysHolidayCalendar.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });
  },

  listHolidays() {
    return db.sysHolidayCalendar.findMany({ orderBy: { date: "asc" } });
  },

  upsertHoliday(data: { date: Date; dayType: Prisma.SysHolidayCalendarCreateInput["dayType"]; closed: boolean; note?: string | null }) {
    return db.sysHolidayCalendar.upsert({
      where: { date: data.date },
      create: data,
      update: { dayType: data.dayType, closed: data.closed, note: data.note },
    });
  },

  deleteHoliday(date: Date) {
    return db.sysHolidayCalendar.delete({ where: { date } });
  },

  // B26: 单日特例查询(主键即日期),供派生读路径与 resolveMonth 取覆盖
  getHoliday(date: Date) {
    return db.sysHolidayCalendar.findUnique({ where: { date } });
  },

  // B33③ 渠道接入配置 CRUD(固定 4 条枚举,只改不增删)
  listChannelConfigs() {
    return db.channelConfig.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
  },
  getChannelConfig(code: BookingChannel) {
    return db.channelConfig.findUnique({ where: { code } });
  },
  updateChannelConfig(code: BookingChannel, data: Prisma.ChannelConfigUpdateInput) {
    return db.channelConfig.update({ where: { code }, data });
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

  // 红线4: 当日全园在园人数 = 该日各物化时段 checked_in_count 之和(派生虚拟行恒 0,不漏计)。
  async sumCheckedInForDate(date: Date): Promise<number> {
    const r = await db.bookingSlot.aggregate({ where: { date }, _sum: { checkedInCount: true } });
    return r._sum.checkedInCount ?? 0;
  },

  // 红线4: 直读 system_config 取瞬时承载量原值——与 checkin 核销写路径同模式(raw 点查,
  // 避免 import system 模块破 eslint-boundaries);解析与缺配兜底交给 shared resolveInstantCapacity。
  async getInstantCapacityRaw(): Promise<string | null> {
    const rows = await db.$queryRaw<{ value: string }[]>(Prisma.sql`
      SELECT value FROM system_config WHERE key = 'park.instant_capacity' LIMIT 1
    `);
    return rows[0]?.value ?? null;
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

  // B26 首单惰性物化下单(取代 createBookingOptimistic 的派生路径):
  //   ① INSERT … ON CONFLICT(date,start_time) DO NOTHING(首单按派生定义建行;已存在/运营手调不动)
  //   ② SELECT … FOR UPDATE 取真实行(按 date+start_time,兼容存量随机 id 行)并行锁
  //   ③ 校验 ACTIVE → 原子配额 UPDATE 守卫(booked+1<=quota,affected=0=满)
  // capacity/各渠道名额只信 slotDef(服务端派生),配额守卫则按真实行当前 quota(尊重运营手调)。
  async materializeAndBook(
    slotDef: SlotDefinition,
    data: CreateBookingData,
    limits?: BookingLimits,
  ): Promise<Booking> {
    const col = CHANNEL_COL[data.channel];
    const qrCode = "bk-" + randomBytes(29).toString("hex");
    const qrSecret = randomBytes(32).toString("hex");
    const capacity =
      slotDef.miniProgramQuota + slotDef.onsiteQuota + slotDef.otaQuota + slotDef.adminQuota;
    const dateStr = slotDef.date.toISOString().slice(0, 10);
    const perPhone = limits?.perPhone ?? 0;
    const perIdCard = limits?.perIdCard ?? 1;
    const totalStock = limits?.dailyTotalStock ?? 0;

    return db.$transaction(async (tx) => {
      // 事务级 advisory 锁(并发计数路径需先序列化同键)。固定顺序 phone→idcard→slot 防死锁。
      // 单证 N=1 走部分唯一索引快路径,无需锁;仅 N>1 才加锁计数。
      if (perPhone > 0) {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`bk:phone:${data.phone}:${dateStr}`}))`);
      }
      if (perIdCard > 1) {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`bk:idcard:${data.idCard}:${dateStr}`}))`);
      }

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO booking_slot
          (id, name, date, start_time, end_time, capacity,
           mini_program_quota, onsite_quota, ota_quota, admin_quota,
           status, created_at, updated_at)
        VALUES
          (${slotDef.id}::uuid, ${slotDef.name}, ${slotDef.date}, ${slotDef.startTime}, ${slotDef.endTime}, ${capacity},
           ${slotDef.miniProgramQuota}, ${slotDef.onsiteQuota}, ${slotDef.otaQuota}, ${slotDef.adminQuota},
           'ACTIVE'::"BookingSlotStatus", NOW(), NOW())
        ON CONFLICT DO NOTHING
      `);
      // 用 bare ON CONFLICT(不点名约束):并发同虚拟 id 撞主键、存量随机 id 行撞(date,start_time)唯一,
      // 两种冲突都需吞掉;点名单一约束只能盖其一(并发首单会撞 pkey)。随后按 date+start_time 取真实行。

      const rows = await tx.$queryRaw<{ id: string; status: BookingSlotStatus }[]>(Prisma.sql`
        SELECT id, status FROM booking_slot
        WHERE date = ${slotDef.date} AND start_time = ${slotDef.startTime}
        FOR UPDATE
      `);
      const row = rows[0];
      if (!row) throw new SlotFullError(); // 兜底:刚插入且无冲突却取不到行,理论不可达
      if (row.status !== "ACTIVE") throw new SlotInactiveError();

      // B31 单手机号当日上限(已加锁,count 安全)。slot_date 为反范式列(触发器同步)。
      if (perPhone > 0) {
        const [{ n }] = await tx.$queryRaw<[{ n: bigint }]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS n FROM booking
          WHERE phone = ${data.phone} AND slot_date = ${slotDef.date}
            AND status IN ('CONFIRMED'::"BookingStatus", 'CHECKED_IN'::"BookingStatus")
        `);
        if (Number(n) >= perPhone) throw new PhoneLimitError();
      }
      // B31 单证 N>1 计数路径(N=1 由部分唯一索引在 booking.create 处拦截)
      if (perIdCard > 1) {
        const [{ n }] = await tx.$queryRaw<[{ n: bigint }]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS n FROM booking
          WHERE id_card = ${data.idCard} AND slot_date = ${slotDef.date}
            AND status IN ('CONFIRMED'::"BookingStatus", 'CHECKED_IN'::"BookingStatus")
        `);
        if (Number(n) >= perIdCard) throw new IdCardLimitError();
      }

      const affected = await tx.$executeRaw(Prisma.sql`
        UPDATE booking_slot
        SET ${Prisma.raw(`"${col}_booked"`)} = ${Prisma.raw(`"${col}_booked"`)} + 1,
            booked_count = booked_count + 1,
            updated_at = NOW()
        WHERE id = ${row.id}::uuid
          AND status = 'ACTIVE'::"BookingSlotStatus"
          AND ${Prisma.raw(`"${col}_booked"`)} + 1 <= ${Prisma.raw(`"${col}_quota"`)}
      `);
      if (affected === 0) throw new SlotFullError();

      // B31 每日总库存:始终计数(反映当日确认数,供取消回退一致);仅 totalStock>0 时作闸。
      if (totalStock > 0) {
        const counted = await tx.$queryRaw<{ total_booked: number }[]>(Prisma.sql`
          INSERT INTO booking_daily_counter (date, total_booked, updated_at)
          VALUES (${slotDef.date}, 1, NOW())
          ON CONFLICT (date) DO UPDATE
            SET total_booked = booking_daily_counter.total_booked + 1, updated_at = NOW()
          WHERE booking_daily_counter.total_booked < ${totalStock}
          RETURNING total_booked
        `);
        if (counted.length === 0) throw new DailyStockExhaustedError();
      } else {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO booking_daily_counter (date, total_booked, updated_at)
          VALUES (${slotDef.date}, 1, NOW())
          ON CONFLICT (date) DO UPDATE
            SET total_booked = booking_daily_counter.total_booked + 1, updated_at = NOW()
        `);
      }

      try {
        return await tx.booking.create({
          data: {
            slotId: row.id,
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

      // B31 每日总库存回退(取消释放名额)。GREATEST 防负;按时段日期定位计数行。
      await tx.$executeRaw(Prisma.sql`
        UPDATE booking_daily_counter
        SET total_booked = GREATEST(0, total_booked - 1), updated_at = NOW()
        WHERE date = (SELECT date FROM booking_slot WHERE id = ${booking.slotId}::uuid)
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

  // B32: countBookings 与 listBookings 共用同一 where,否则分页总数与列表口径不一致
  countBookings(filter: BookingListFilter = {}) {
    return db.booking.count({ where: bookingWhere(filter) });
  },

  // B22/B32: 预约单查询 — 按身份证/手机号(模糊)+ 状态过滤,含时段,倒序。
  // opts.skip/take 支持 offset 分页;不传 take 时回退 200 作安全上限。
  listBookings(
    filter: BookingListFilter,
    opts?: { skip?: number; take?: number },
  ) {
    return db.booking.findMany({
      where: bookingWhere(filter),
      include: { slot: true },
      orderBy: { createdAt: "desc" },
      skip: opts?.skip,
      take: opts?.take ?? 200,
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

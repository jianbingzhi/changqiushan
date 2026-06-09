import {
  bookingRepository, SlotFullError, DuplicateBookingError, SlotInactiveError,
  DailyStockExhaustedError, PhoneLimitError, IdCardLimitError,
} from "../repository";
import type { BookingListFilter, SlotDefinition, BookingLimits } from "../repository";
import { createBookingSchema, createSlotSchema } from "../domain/schema";
import { assertDualElements, canBook, canCancel } from "../domain/rules";
import { deriveSlots, type DerivedSlot } from "../domain/slot-derive";
import { ok, err, ErrCode, type Result } from "@/shared/result";
import { Prisma } from "@prisma/client";
import type { Booking, BookingSlot, BookingSlotStatus } from "@prisma/client";

// B26 读路径合并视图:物化行(真实已用量)与派生虚拟行同形,materialized 标识来源。
export type SlotView = {
  id:                string;
  date:              Date;
  name:              string;
  startTime:         string;
  endTime:           string;
  capacity:          number;
  miniProgramQuota:  number;
  onsiteQuota:       number;
  otaQuota:          number;
  adminQuota:        number;
  miniProgramBooked: number;
  onsiteBooked:      number;
  otaBooked:         number;
  adminBooked:       number;
  bookedCount:       number;
  checkedInCount:    number;
  status:            BookingSlotStatus;
  materialized:      boolean;
};

function materializedToView(s: BookingSlot): SlotView {
  return {
    id: s.id, date: s.date, name: s.name, startTime: s.startTime, endTime: s.endTime,
    capacity: s.capacity,
    miniProgramQuota: s.miniProgramQuota, onsiteQuota: s.onsiteQuota, otaQuota: s.otaQuota, adminQuota: s.adminQuota,
    miniProgramBooked: s.miniProgramBooked, onsiteBooked: s.onsiteBooked, otaBooked: s.otaBooked, adminBooked: s.adminBooked,
    bookedCount: s.bookedCount, checkedInCount: s.checkedInCount, status: s.status, materialized: true,
  };
}

function derivedToView(d: DerivedSlot): SlotView {
  return { ...d, materialized: false };
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

// 同日同开始时间唯一约束(booking_slot_date_start_time_key)被并发/双提交命中
const isSlotConflict = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

// booking_slot.date 是 @db.Date;用 UTC 零点构造,避免本地时区把日历日挪到前一天
// (与 seed / onsite 取数口径一致)。入参为北京日历日串 YYYY-MM-DD。
const toSlotDate = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`);

function defFromMaterialized(s: BookingSlot): SlotDefinition {
  return {
    id: s.id, date: s.date, name: s.name, startTime: s.startTime, endTime: s.endTime,
    miniProgramQuota: s.miniProgramQuota, onsiteQuota: s.onsiteQuota, otaQuota: s.otaQuota, adminQuota: s.adminQuota,
  };
}

// B26 下单时段解析:① 物化优先(按 id 直查,含运营手调/存量随机 id 行)
//   ② 未命中且带 date → 当日派生中按虚拟 id 匹配(首单惰性物化)
// 返回校验视图(view)+ 权威定义(def,只信服务端派生/物化行,绝不信前端配额)。
async function resolveSlotForBooking(
  slotId: string,
  dateStr: string | undefined,
): Promise<{ view: SlotView; def: SlotDefinition } | null> {
  const materialized = await bookingRepository.getSlot(slotId);
  if (materialized) {
    return { view: materializedToView(materialized), def: defFromMaterialized(materialized) };
  }
  if (!dateStr) return null;
  const [templates, holiday] = await Promise.all([
    bookingRepository.listEnabledTemplates(),
    bookingRepository.getHoliday(toSlotDate(dateStr)),
  ]);
  const derived = deriveSlots(dateStr, templates, holiday).find((d) => d.id === slotId);
  if (!derived) return null;
  return {
    view: derivedToView(derived),
    def: {
      id: derived.id, date: derived.date, name: derived.name, startTime: derived.startTime, endTime: derived.endTime,
      miniProgramQuota: derived.miniProgramQuota, onsiteQuota: derived.onsiteQuota, otaQuota: derived.otaQuota, adminQuota: derived.adminQuota,
    },
  };
}

export const bookingService = {
  async createBooking(raw: unknown, limits?: BookingLimits): Promise<Result<Booking>> {
    const parsed = createBookingSchema.safeParse(raw);
    if (!parsed.success) {
      return err(ErrCode.INVALID_INPUT, parsed.error.issues[0]?.message ?? "输入校验失败");
    }
    const input = parsed.data;

    const dualCheck = assertDualElements(
      input.idCard,
      input.plate,
      input.noVehicleDeclared ?? false,
    );
    if (!dualCheck.ok) return dualCheck;

    // B33③ 渠道启停校验:被停用的渠道不接收新单(无配置行视为启用)。
    // 取舍:此检查与下单 INSERT 不在同一事务,存在「检查后、落库前被停用」的极窄竞态;
    // 渠道启停是低频运营操作(非高并发闸),接受最终一致,不为此引入跨表锁。
    const channelRow = await bookingRepository.getChannelConfig(input.channel);
    if (channelRow && !channelRow.enabled) {
      return err(ErrCode.CHANNEL_DISABLED, "该预约渠道已暂停接入");
    }

    // B26 解析时段:物化优先(按 id 直查),否则按 date 派生回退(虚拟时段首单惰性物化)。
    const resolved = await resolveSlotForBooking(input.slotId, input.date);
    if (!resolved) return err(ErrCode.NOT_FOUND, "预约时段不存在");
    const { view, def } = resolved;

    if (!canBook(view, input.channel)) {
      return view.status !== "ACTIVE"
        ? err(ErrCode.SLOT_INACTIVE, "该时段暂停或已关闭预约")
        : err(ErrCode.SLOT_FULL, "该渠道名额已满");
    }

    // 红线4 熔断不在此处按单时段口径预判(分母错且对未物化派生行 checkedIn 恒 0)。
    // 真正口径统一的执行点在核销写路径(checkin):全园在园/瞬时承载 ≥90% → PAUSE 当日全部 ACTIVE 时段,
    // 随后 canBook(status=ACTIVE) 即拒绝新单。此处只信任时段 status,避免重复且错误的园区级判定。

    // 单证 N=1(默认)快路径预判:命中即免入事务;N>1 由事务内计数 + advisory 锁处理。
    if ((limits?.perIdCard ?? 1) <= 1) {
      const daily = await bookingRepository.countDailyBookings(input.idCard, def.date);
      if (daily > 0) return err(ErrCode.DUPLICATE_BOOKING, "同一身份证当日已有预约");
    }

    try {
      const booking = await bookingRepository.materializeAndBook(def, {
        slotId: def.id,
        visitorName: input.visitorName,
        idCard: input.idCard,
        phone: input.phone,
        plate: input.plate,
        noVehicleDeclared: input.noVehicleDeclared ?? false,
        channel: input.channel,
      }, limits);
      return ok(booking);
    } catch (e) {
      if (e instanceof SlotFullError) {
        return err(ErrCode.SLOT_FULL, "并发冲突，名额已满，请重试");
      }
      if (e instanceof SlotInactiveError) {
        return err(ErrCode.SLOT_INACTIVE, "该时段已暂停预约（在园人数达限）");
      }
      if (e instanceof DailyStockExhaustedError) {
        return err(ErrCode.SLOT_FULL, "当日预约名额已约满，请改约其他日期");
      }
      if (e instanceof PhoneLimitError) {
        return err(ErrCode.DUPLICATE_BOOKING, "该手机号当日预约已达上限");
      }
      if (e instanceof IdCardLimitError) {
        return err(ErrCode.DUPLICATE_BOOKING, "同一身份证当日预约已达上限");
      }
      if (e instanceof DuplicateBookingError) {
        return err(ErrCode.DUPLICATE_BOOKING, "同一身份证当日已有预约");
      }
      throw e;
    }
  },

  // B32: 预约单分页查询 — count 与 list 共用同一 filter,返回页码元信息。
  // pageSize clamp 至 [1,100];请求页超出末页时回落到末页(避免空白页)。
  async listBookingsPaged(
    filter: BookingListFilter,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  ) {
    const size = Math.min(Math.max(Math.trunc(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const requested = Math.max(Math.trunc(page) || 1, 1);
    const total = await bookingRepository.countBookings(filter);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const current = Math.min(requested, totalPages);
    const items = await bookingRepository.listBookings(filter, {
      skip: (current - 1) * size,
      take: size,
    });
    return { items, total, page: current, pageSize: size, totalPages };
  },

  // B32: 导出用 — 取全量(带上限)匹配项,不分页
  listBookingsForExport(filter: BookingListFilter, cap = 50000) {
    return bookingRepository.listBookings(filter, { take: cap });
  },

  // B26 读路径:合并「已物化行(真实已用量)+ 派生虚拟行」,已物化优先(同 startTime 覆盖派生)。
  // 取代裸 listSlotsByDate 作为对外读口;repo 仍保留供合并。
  async listSlotsForDate(dateStr: string): Promise<SlotView[]> {
    const date = toSlotDate(dateStr);
    const [materialized, templates, holiday] = await Promise.all([
      bookingRepository.listSlotsByDate(date),
      bookingRepository.listEnabledTemplates(),
      bookingRepository.getHoliday(date),
    ]);
    const byStart = new Map<string, SlotView>();
    for (const d of deriveSlots(dateStr, templates, holiday)) byStart.set(d.startTime, derivedToView(d));
    for (const m of materialized) byStart.set(m.startTime, materializedToView(m)); // 已物化优先
    return [...byStart.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  },

  // C 端「我的中心」只读统计聚合(按身份证)
  getVisitorStats(idCard: string) {
    return bookingRepository.getVisitorStats(idCard);
  },

  async cancelBooking(bookingId: string): Promise<Result<void>> {
    const booking = await bookingRepository.getBookingWithSlot(bookingId);
    if (!booking) return err(ErrCode.NOT_FOUND, "预约单不存在");
    if (booking.status !== "CONFIRMED") {
      return err(ErrCode.INVALID_INPUT, "仅「已确认」状态的预约可取消");
    }
    if (!canCancel(booking.slot, new Date())) {
      return err(ErrCode.INVALID_INPUT, "距开始时间不足 2 小时，无法取消");
    }
    await bookingRepository.cancelBooking(bookingId);
    return ok(undefined);
  },

  async pauseSlotsForCircuitBreak(date: Date): Promise<void> {
    await bookingRepository.pauseSlotsForCircuitBreak(date);
  },

  // A1: 幂等恢复 — 仅 PAUSED → ACTIVE，不影响 CLOSED
  async resumePausedSlots(date: Date): Promise<void> {
    await bookingRepository.resumePausedSlots(date);
  },

  // C4 止血:运营手动建单个时段。同日同开始时间判重,避免重复时段。
  async createSlot(raw: unknown): Promise<Result<BookingSlot>> {
    const parsed = createSlotSchema.safeParse(raw);
    if (!parsed.success) {
      return err(ErrCode.INVALID_INPUT, parsed.error.issues[0]?.message ?? "输入校验失败");
    }
    const input = parsed.data;
    const date = toSlotDate(input.date);

    const existing = await bookingRepository.listSlotsByDate(date);
    if (existing.some((s) => s.startTime === input.startTime)) {
      return err(ErrCode.CONFLICT, "该日已存在相同开始时间的时段");
    }

    try {
      const slot = await bookingRepository.createSlot({
        date,
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        miniProgramQuota: input.miniProgramQuota,
        onsiteQuota: input.onsiteQuota,
        otaQuota: input.otaQuota,
        adminQuota: input.adminQuota,
      });
      return ok(slot);
    } catch (e) {
      // 并发/双提交:唯一约束兜底(check-then-insert 的 TOCTOU 窗口)
      if (isSlotConflict(e)) return err(ErrCode.CONFLICT, "该日已存在相同开始时间的时段");
      throw e;
    }
  },

  // C4 止血:把来源日的时段结构复制到目标日(已用量归零、状态 ACTIVE)。
  // 幂等:跳过目标日已存在的开始时间,可重复点击。
  async copyDaySlots(
    sourceDate: string,
    targetDate: string,
  ): Promise<Result<{ created: number; skipped: number }>> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate) || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return err(ErrCode.INVALID_INPUT, "日期格式无效");
    }
    const src = toSlotDate(sourceDate);
    const tgt = toSlotDate(targetDate);

    const sourceSlots = await bookingRepository.listSlotsByDate(src);
    if (sourceSlots.length === 0) {
      return err(ErrCode.NOT_FOUND, "来源日无时段可复制");
    }
    const existingTimes = new Set(
      (await bookingRepository.listSlotsByDate(tgt)).map((s) => s.startTime),
    );
    const toCreate = sourceSlots
      .filter((s) => !existingTimes.has(s.startTime))
      .map((s) => ({
        date: tgt,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: s.capacity,
        miniProgramQuota: s.miniProgramQuota,
        onsiteQuota: s.onsiteQuota,
        otaQuota: s.otaQuota,
        adminQuota: s.adminQuota,
        status: "ACTIVE" as const,
      }));

    try {
      const created = toCreate.length
        ? await bookingRepository.createManySlots(toCreate)
        : 0;
      return ok({ created, skipped: sourceSlots.length - toCreate.length });
    } catch (e) {
      // 并发:目标日时段在读取后被他人建出,唯一约束拦截整批 → 提示重试(再点即幂等跳过)
      if (isSlotConflict(e)) {
        return err(ErrCode.CONFLICT, "目标日时段已被并发创建，请刷新后重试");
      }
      throw e;
    }
  },
};

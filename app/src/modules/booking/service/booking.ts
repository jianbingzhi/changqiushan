import { bookingRepository, SlotFullError, DuplicateBookingError } from "../repository";
import { createBookingSchema, createSlotSchema } from "../domain/schema";
import { assertDualElements, canBook, canCancel, isCircuitBroken } from "../domain/rules";
import { ok, err, ErrCode, type Result } from "@/shared/result";
import type { Booking, BookingSlot } from "@prisma/client";

// booking_slot.date 是 @db.Date;用 UTC 零点构造,避免本地时区把日历日挪到前一天
// (与 seed / onsite 取数口径一致)。入参为北京日历日串 YYYY-MM-DD。
const toSlotDate = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`);

export const bookingService = {
  async createBooking(raw: unknown): Promise<Result<Booking>> {
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

    const slot = await bookingRepository.getSlot(input.slotId);
    if (!slot) return err(ErrCode.NOT_FOUND, "预约时段不存在");

    if (!canBook(slot, input.channel)) {
      return slot.status !== "ACTIVE"
        ? err(ErrCode.SLOT_INACTIVE, "该时段暂停或已关闭预约")
        : err(ErrCode.SLOT_FULL, "该渠道名额已满");
    }

    if (isCircuitBroken(slot.checkedInCount, slot.capacity)) {
      return err(ErrCode.CIRCUIT_BREAKER_OPEN, "在园人数达限，入园预约已暂停");
    }

    const daily = await bookingRepository.countDailyBookings(input.idCard, slot.date);
    if (daily > 0) return err(ErrCode.DUPLICATE_BOOKING, "同一身份证当日已有预约");

    try {
      const booking = await bookingRepository.createBookingOptimistic({
        slotId: input.slotId,
        visitorName: input.visitorName,
        idCard: input.idCard,
        phone: input.phone,
        plate: input.plate,
        noVehicleDeclared: input.noVehicleDeclared ?? false,
        channel: input.channel,
      });
      return ok(booking);
    } catch (e) {
      if (e instanceof SlotFullError) {
        return err(ErrCode.SLOT_FULL, "并发冲突，名额已满，请重试");
      }
      if (e instanceof DuplicateBookingError) {
        return err(ErrCode.DUPLICATE_BOOKING, "同一身份证当日已有预约");
      }
      throw e;
    }
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

    const created = toCreate.length
      ? await bookingRepository.createManySlots(toCreate)
      : 0;
    return ok({ created, skipped: sourceSlots.length - toCreate.length });
  },
};

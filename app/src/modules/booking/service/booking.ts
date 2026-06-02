import { bookingRepository, SlotFullError } from "../repository";
import { createBookingSchema } from "../domain/schema";
import { assertDualElements, canBook, canCancel, isCircuitBroken } from "../domain/rules";
import { ok, err, ErrCode, type Result } from "@/shared/result";
import type { Booking } from "@prisma/client";

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
      throw e;
    }
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
};

import type { BookingSlotStatus, BookingChannel } from "@prisma/client";
import { err, ok, ErrCode, type Result } from "@/shared/result";
import { isValidIdCard, isValidPlate } from "@/shared/validators";
import { CIRCUIT_BREAK_RATIO, CIRCUIT_RESUME_RATIO } from "@/shared/lib/capacity";

// 渠道配额校验只依赖这些字段;物化行(BookingSlot)与派生视图(SlotView)都满足,故结构化解耦。
export type SlotQuotaShape = {
  status:            BookingSlotStatus;
  miniProgramQuota:  number;
  onsiteQuota:       number;
  otaQuota:          number;
  adminQuota:        number;
  miniProgramBooked: number;
  onsiteBooked:      number;
  otaBooked:         number;
  adminBooked:       number;
};

const CHANNEL_FIELD_MAP: Record<
  BookingChannel,
  { quota: keyof SlotQuotaShape; booked: keyof SlotQuotaShape }
> = {
  MINI_PROGRAM:  { quota: "miniProgramQuota", booked: "miniProgramBooked" },
  ONSITE_MAKEUP: { quota: "onsiteQuota",      booked: "onsiteBooked" },
  OTA:           { quota: "otaQuota",         booked: "otaBooked" },
  ADMIN_MANUAL:  { quota: "adminQuota",       booked: "adminBooked" },
};

export function assertDualElements(
  idCard: string,
  plate: string | undefined,
  noVehicleDeclared: boolean,
): Result<true> {
  if (!isValidIdCard(idCard)) {
    return err(ErrCode.INVALID_INPUT, "身份证号校验失败");
  }
  const hasPlate = !!plate && plate.trim().length > 0;
  if (hasPlate && !isValidPlate(plate!)) {
    return err(ErrCode.INVALID_INPUT, "车牌号格式不合法");
  }
  if (!hasPlate && !noVehicleDeclared) {
    return err(ErrCode.INVALID_INPUT, "必须提供车牌号或勾选「无车辆」声明");
  }
  if (hasPlate && noVehicleDeclared) {
    return err(ErrCode.INVALID_INPUT, "已填写车牌号，不可同时声明「无车辆」");
  }
  return ok(true);
}

export function canBook(slot: SlotQuotaShape, channel: BookingChannel): boolean {
  if (slot.status !== "ACTIVE") return false;
  const { quota, booked } = CHANNEL_FIELD_MAP[channel];
  const q = slot[quota] as number;
  const b = slot[booked] as number;
  return q > 0 && b + 1 <= q;
}

// 红线4 口径统一:分母恒为「瞬时承载量」(park.instant_capacity),分子为「全园在园人数」
// (当日各时段 checked_in_count 之和),绝非单时段 capacity/checkedIn(后者会让 90% 几乎永不触发,B4)。
export function isCircuitBroken(inParkCount: number, instantCapacity: number): boolean {
  return instantCapacity > 0 && inParkCount / instantCapacity >= CIRCUIT_BREAK_RATIO;
}

// 迟滞恢复:全园在园回落到瞬时承载量 80% 以下方可恢复。
export function canResume(inParkCount: number, instantCapacity: number): boolean {
  return instantCapacity <= 0 || inParkCount / instantCapacity < CIRCUIT_RESUME_RATIO;
}

export function canCancel(slot: { date: Date; startTime: string }, now: Date): boolean {
  const slotStart = new Date(
    `${slot.date.toISOString().slice(0, 10)}T${slot.startTime}:00+08:00`,
  );
  return slotStart.getTime() - now.getTime() > 2 * 60 * 60 * 1000;
}

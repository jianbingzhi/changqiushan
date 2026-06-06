import type { BookingSlot, BookingChannel } from "@prisma/client";
import { err, ok, ErrCode, type Result } from "@/shared/result";
import { isValidIdCard, isValidPlate } from "@/shared/validators";
import { CIRCUIT_BREAK_RATIO, CIRCUIT_RESUME_RATIO } from "@/shared/lib/capacity";

const CHANNEL_FIELD_MAP: Record<
  BookingChannel,
  { quota: keyof BookingSlot; booked: keyof BookingSlot }
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

export function canBook(slot: BookingSlot, channel: BookingChannel): boolean {
  if (slot.status !== "ACTIVE") return false;
  const { quota, booked } = CHANNEL_FIELD_MAP[channel];
  const q = slot[quota] as number;
  const b = slot[booked] as number;
  return q > 0 && b + 1 <= q;
}

export function isCircuitBroken(checkedInCount: number, capacity: number): boolean {
  return capacity > 0 && checkedInCount / capacity >= CIRCUIT_BREAK_RATIO;
}

export function canResume(checkedInCount: number, capacity: number): boolean {
  return capacity <= 0 || checkedInCount / capacity < CIRCUIT_RESUME_RATIO;
}

export function canCancel(slot: BookingSlot, now: Date): boolean {
  const slotStart = new Date(
    `${slot.date.toISOString().slice(0, 10)}T${slot.startTime}:00+08:00`,
  );
  return slotStart.getTime() - now.getTime() > 2 * 60 * 60 * 1000;
}

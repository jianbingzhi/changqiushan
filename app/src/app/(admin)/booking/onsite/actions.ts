"use server";

import { bookingRepository, bookingService } from "@/modules/booking";
import { riskcontrolService } from "@/modules/riskcontrol";
import { requireRole, ANY_STAFF } from "@/infrastructure/auth/guard";

export interface OnsiteSlotOption {
  id: string;
  label: string;
  soldOut: boolean;
}

/** B10 时段选择器:按日期取当日 ACTIVE 时段 + 现场渠道余量 */
export async function getOnsiteSlots(date: string): Promise<OnsiteSlotOption[]> {
  // booking_slot.date 是纯日期列(@db.Date);用 UTC 零点构造,避免本地时区把日期挪到前一天
  const target = new Date(date + "T00:00:00Z");
  const slots = await bookingRepository.listSlotsByDate(target);
  return slots
    .filter((s) => s.status === "ACTIVE")
    .map((s) => {
      const remain = Math.max(0, s.onsiteQuota - s.onsiteBooked);
      return {
        id: s.id,
        label: `${s.name}（${s.startTime}–${s.endTime}，现场余 ${remain}）`,
        soldOut: remain <= 0,
      };
    });
}

export interface OnsiteBookingInput {
  slotId: string;
  visitorName: string;
  phone: string;
  idCard: string;
  hasVehicle: boolean;
  plate: string;
  noVehicleDeclared: boolean;
}

export type OnsiteBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; message: string };

/** E3 修复 + B10 接线:黑名单前置 → 现场补录渠道下单(真正落库) */
export async function submitOnsiteBooking(
  input: OnsiteBookingInput,
): Promise<OnsiteBookingResult> {
  const auth = await requireRole(ANY_STAFF);
  if (!auth.ok) return { ok: false, message: auth.message };

  // 3.6 / Y5:下单前黑名单拦截(B 端唯一下单口)
  if (await riskcontrolService.isBlacklistedByIdCard(input.idCard)) {
    return { ok: false, message: "该身份证已被列入黑名单，暂无法预约，请引导游客走申诉流程" };
  }

  const result = await bookingService.createBooking({
    slotId: input.slotId,
    visitorName: input.visitorName,
    phone: input.phone,
    idCard: input.idCard,
    plate: input.hasVehicle ? input.plate : undefined,
    noVehicleDeclared: input.hasVehicle ? false : input.noVehicleDeclared,
    channel: "ONSITE_MAKEUP",
  });

  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, bookingId: result.value.id };
}

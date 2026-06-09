"use server";

import { bookingService } from "@/modules/booking";
import { configService } from "@/modules/system";
import { riskcontrolService } from "@/modules/riskcontrol";
import { requireRole, ANY_STAFF } from "@/infrastructure/auth/guard";

export interface OnsiteSlotOption {
  id: string;
  label: string;
  soldOut: boolean;
}

/** B10 时段选择器:按日期取当日 ACTIVE 时段 + 现场渠道余量(B26:派生+物化合并,虚拟时段可下单) */
export async function getOnsiteSlots(date: string): Promise<OnsiteSlotOption[]> {
  const slots = await bookingService.listSlotsForDate(date);
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
  date: string; // B26:虚拟时段惰性物化需带北京日历日
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

  // B31:app 路由层读出防黄牛阈值注入(守 eslint-boundaries,booking 不反向 import system)
  const limits = await configService.getBookingLimits();
  const result = await bookingService.createBooking({
    slotId: input.slotId,
    date: input.date,
    visitorName: input.visitorName,
    phone: input.phone,
    idCard: input.idCard,
    plate: input.hasVehicle ? input.plate : undefined,
    noVehicleDeclared: input.hasVehicle ? false : input.noVehicleDeclared,
    channel: "ONSITE_MAKEUP",
  }, limits);

  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, bookingId: result.value.id };
}

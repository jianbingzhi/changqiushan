"use server";

import { revalidatePath } from "next/cache";
import { requireRole, ADMIN_UP } from "@/infrastructure/auth/guard";
import { bookingService } from "@/modules/booking";

export type SlotActionResult = { ok: boolean; message: string };

export interface CreateSlotPayload {
  date: string;
  name: string;
  startTime: string;
  endTime: string;
  miniProgramQuota: number;
  onsiteQuota: number;
  otaQuota: number;
  adminQuota: number;
}

// C4 止血:新建单个时段(仅管理及以上)
export async function createSlotAction(
  payload: CreateSlotPayload,
): Promise<SlotActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const res = await bookingService.createSlot(payload);
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/booking/slots");
  return { ok: true, message: `已新建时段「${res.value.name}」` };
}

// C4 止血:复制目标日「前一天」的时段结构到目标日(幂等跳过已存在)
export async function copyPrevDaySlotsAction(
  targetDate: string,
): Promise<SlotActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return { ok: false, message: "目标日期格式无效" };
  }
  // 目标日前一天(UTC 日历日减一,日期串运算与时区无关)
  const d = new Date(`${targetDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const sourceDate = d.toISOString().slice(0, 10);

  const res = await bookingService.copyDaySlots(sourceDate, targetDate);
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/booking/slots");
  return {
    ok: true,
    message: `已复制 ${res.value.created} 个时段，跳过 ${res.value.skipped} 个已存在`,
  };
}

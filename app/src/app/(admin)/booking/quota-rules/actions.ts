"use server";

import { revalidatePath } from "next/cache";
import { requireRole, ADMIN_UP } from "@/infrastructure/auth/guard";
import { quotaRuleService, slotRollService } from "@/modules/booking";
import { configService } from "@/modules/system";

export type RuleActionResult = { ok: boolean; message: string };

export interface TemplatePayload {
  id?: string;
  dayType: string;
  name: string;
  startTime: string;
  endTime: string;
  miniProgramQuota: number;
  onsiteQuota: number;
  otaQuota: number;
  adminQuota: number;
  enabled: boolean;
}

export async function saveTemplateAction(payload: TemplatePayload): Promise<RuleActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const res = payload.id
    ? await quotaRuleService.updateTemplate(payload.id, payload)
    : await quotaRuleService.createTemplate(payload);
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/booking/quota-rules");
  return { ok: true, message: payload.id ? "已保存模板修改" : `已新建时段模板「${res.value.name}」` };
}

export async function deleteTemplateAction(id: string): Promise<RuleActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const res = await quotaRuleService.deleteTemplate(id);
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/booking/quota-rules");
  return { ok: true, message: "已删除模板" };
}

export interface HolidayPayload {
  date: string;
  dayType: string;
  closed: boolean;
  note?: string;
}

export async function saveHolidayAction(payload: HolidayPayload): Promise<RuleActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const res = await quotaRuleService.upsertHoliday(payload);
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/booking/quota-rules");
  return { ok: true, message: "已保存特例日历" };
}

export async function deleteHolidayAction(date: string): Promise<RuleActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const res = await quotaRuleService.deleteHoliday(date);
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/booking/quota-rules");
  return { ok: true, message: "已删除特例" };
}

// BE-A3:立即生成未来 N 天时段(免等当晚 cron);horizon 从 SysConfig 读出注入(app 层组合)。
export async function generateSlotsNowAction(): Promise<RuleActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const horizon = await configService.getInt("slot.horizon_days", 14);
  const res = await slotRollService.rollGenerateSlots(horizon);
  if (!res.ok) return { ok: false, message: res.message };

  if (res.value.candidates === 0) {
    return { ok: false, message: "未生成:请先新建并启用时段模板" };
  }
  revalidatePath("/booking/quota-rules");
  revalidatePath("/booking/slots");
  return {
    ok: true,
    message: `已按 ${res.value.days} 天展开:新建 ${res.value.created} 个时段(跳过已存在 ${res.value.candidates - res.value.created} 个,闭园 ${res.value.closedDays} 天)`,
  };
}

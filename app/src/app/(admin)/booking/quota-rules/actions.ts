"use server";

import { revalidatePath } from "next/cache";
import { requireRole, ADMIN_UP } from "@/infrastructure/auth/guard";
import { quotaRuleService } from "@/modules/booking";

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

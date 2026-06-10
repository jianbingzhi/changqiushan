"use server";

import { revalidatePath } from "next/cache";
import { requireRole, ADMIN_UP } from "@/infrastructure/auth/guard";
import { quotaRuleService } from "@/modules/booking";
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

// B31 区间套规则:把日期类型/闭园批量写入区间(写特例,不触发物化)
export interface RangeRulePayload {
  startDate: string;
  endDate: string;
  dayType: string;
  closed: boolean;
  note?: string;
}

export async function applyRangeRuleAction(payload: RangeRulePayload): Promise<RuleActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const res = await quotaRuleService.applyRangeRule({
    startDate: payload.startDate,
    endDate: payload.endDate,
    dayType: payload.dayType as "WEEKDAY" | "WEEKEND" | "HOLIDAY",
    closed: payload.closed,
    note: payload.note,
  });
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/booking/quota-rules");
  return { ok: true, message: `已对 ${res.value.applied} 天套用规则` };
}

// B31 防黄牛阈值保存(每日总库存 / 单证 / 单手机上限)
export interface BookingLimitsPayload {
  dailyTotalStock: number;
  perIdCard: number;
  perPhone: number;
}

export async function saveBookingLimitsAction(payload: BookingLimitsPayload): Promise<RuleActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const clamp = (n: number) => (Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0);
  await configService.setConfig({ key: "booking.daily_total_stock", value: String(clamp(payload.dailyTotalStock)), valueType: "int", label: "每日总库存上限(0=不限)" });
  await configService.setConfig({ key: "booking.daily_limit_per_idcard", value: String(Math.max(1, clamp(payload.perIdCard))), valueType: "int", label: "单身份证单日预约上限" });
  await configService.setConfig({ key: "booking.daily_limit_per_phone", value: String(clamp(payload.perPhone)), valueType: "int", label: "单手机号单日预约上限(0=不限)" });

  revalidatePath("/booking/quota-rules");
  return { ok: true, message: "已保存预约总量规则" };
}

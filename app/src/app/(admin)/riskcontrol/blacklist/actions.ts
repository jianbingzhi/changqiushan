"use server";

import { revalidatePath } from "next/cache";
import { riskcontrolService } from "@/modules/riskcontrol";
import { getSession } from "@/infrastructure/auth/session";

export type RiskActionResult = { ok: boolean; message: string };

/** B11: 申诉审核 — 通过则自动移除黑名单 + 清零爽约计数(service 内编排) */
export async function reviewAppealAction(
  appealId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<RiskActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "未登录" };
  const r = await riskcontrolService.reviewAppeal({
    appealId,
    status: decision,
    reviewedBy: session.userId,
  });
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath("/riskcontrol/blacklist");
  return { ok: true, message: decision === "APPROVED" ? "已通过申诉并移除黑名单" : "已驳回申诉" };
}

/** B11: 直接移除黑名单 */
export async function removeBlacklistAction(userId: string): Promise<RiskActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "未登录" };
  const r = await riskcontrolService.removeFromBlacklist(userId);
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath("/riskcontrol/blacklist");
  return { ok: true, message: "已移除黑名单" };
}

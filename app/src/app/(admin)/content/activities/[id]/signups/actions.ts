"use server";

import { revalidatePath } from "next/cache";
import { contentRepository } from "@/modules/content";
import { requireRole, ADMIN_UP } from "@/infrastructure/auth/guard";

export type SignupReviewResult = { ok: boolean; message: string };

/**
 * B23: 报名审核 — 仅影响参与资格,不触碰支付(R1:B 端不调起支付)。
 * 模型无独立审核状态列,决定写入 notes 备注留痕。
 */
export async function reviewSignupAction(
  activityId: string,
  signupId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<SignupReviewResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return auth;
  try {
    await contentRepository.updateSignup(signupId, {
      notes: decision === "APPROVED" ? "审核通过" : "审核驳回",
    });
  } catch {
    return { ok: false, message: "审核失败,请重试" };
  }
  revalidatePath(`/content/activities/${activityId}/signups`);
  return { ok: true, message: decision === "APPROVED" ? "已通过" : "已驳回" };
}

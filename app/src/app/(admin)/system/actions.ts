"use server";

import { revalidatePath } from "next/cache";
import { adminService } from "@/modules/system";
import { getSession } from "@/infrastructure/auth/session";

export type SystemActionResult = { ok: boolean; message: string };

/** B25: 新建管理员账号(GoTrue 建号 + sys_profile 两步事务,角色入 app_metadata) */
export async function createAdminAction(input: {
  phone: string;
  password: string;
  name: string;
  workerId?: string;
  roleCode: string;
}): Promise<SystemActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "未登录" };
  const r = await adminService.createAdmin(input);
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath("/system");
  return { ok: true, message: "账号已创建" };
}

/** B25: 停用账号 */
export async function disableAdminAction(targetId: string): Promise<SystemActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "未登录" };
  const r = await adminService.disableAdmin(session.userId, targetId);
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath("/system");
  return { ok: true, message: "账号已停用" };
}

/** B25: 重置密码 */
export async function resetPasswordAction(targetId: string, newPassword: string): Promise<SystemActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "未登录" };
  const r = await adminService.resetPassword(targetId, newPassword);
  if (!r.ok) return { ok: false, message: r.message };
  return { ok: true, message: "密码已重置" };
}

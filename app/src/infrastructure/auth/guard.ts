import { getSession, type Session } from "./session";

export type GuardResult =
  | { ok: true; session: Session }
  | { ok: false; message: string };

// 角色常量单一来源在 shared/auth/roles(edge middleware 也用同一份);此处再导出供旧引用点不变
export { ANY_STAFF, ADMIN_UP, SUPER_ONLY, type AppRole } from "@/shared/auth/roles";

/**
 * Server Action 授权守卫:Server Action 是独立可达的 POST 端点,中间件只做
 * cookie 存在性粗校验,故每个写操作必须自行按业务角色(app_metadata.role)鉴权。
 */
export async function requireRole(allowed: readonly string[]): Promise<GuardResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "未登录" };
  if (!session.appRole || !allowed.includes(session.appRole)) {
    return { ok: false, message: "权限不足" };
  }
  return { ok: true, session };
}

import { getSession, type Session } from "./session";

export type GuardResult =
  | { ok: true; session: Session }
  | { ok: false; message: string };

// 所有业务角色(已登录员工)
export const ANY_STAFF = ["SUPER_ADMIN", "ADMIN", "OPERATOR"] as const;
// 管理及以上
export const ADMIN_UP = ["SUPER_ADMIN", "ADMIN"] as const;
// 仅超级管理员
export const SUPER_ONLY = ["SUPER_ADMIN"] as const;

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

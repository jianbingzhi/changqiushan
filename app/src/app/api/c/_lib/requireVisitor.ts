// 游客鉴权 helper — 所有需登录的 /api/c/* handler 共用
import { getVisitorSession, type VisitorSession } from "@/infrastructure/auth/visitor-session";

export type RequireVisitorResult =
  | { ok: true; session: VisitorSession }
  | { ok: false; response: Response };

/** 校验游客 JWT;未登录/失效统一返回 401(C 端据此静默重登)。 */
export async function requireVisitor(req: Request): Promise<RequireVisitorResult> {
  const session = await getVisitorSession(req);
  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { success: false, code: "UNAUTHORIZED", message: "登录已过期，请重新登录" },
        { status: 401 },
      ),
    };
  }
  return { ok: true, session };
}

/** 需已绑定实名的场景:在登录基础上再要求 boundIdCard 存在 */
export async function requireBoundVisitor(
  req: Request,
): Promise<{ ok: true; session: VisitorSession & { boundIdCard: string } } | { ok: false; response: Response }> {
  const result = await requireVisitor(req);
  if (!result.ok) return result;
  if (!result.session.boundIdCard) {
    return {
      ok: false,
      response: Response.json(
        { success: false, code: "IDENTITY_REQUIRED", message: "请先完成实名绑定" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, session: { ...result.session, boundIdCard: result.session.boundIdCard } };
}

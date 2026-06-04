// 游客会话 — 自签 JWT(对称 session.ts,独立密钥 VISITOR_JWT_SECRET)
// 与 admin(GoTrue) 体系隔离:独立 issuer/audience,游客 token 永远不含 admin 角色。
import { SignJWT, jwtVerify } from "jose";

const VISITOR_JWT_SECRET = process.env.VISITOR_JWT_SECRET ?? "";
const VISITOR_JWT_ISSUER = "changqiushan-cside";
const VISITOR_JWT_AUDIENCE = "changqiushan-visitor";
// 与 B 端联调期 session 7 天对齐
const VISITOR_TOKEN_TTL = "7d";

export interface VisitorSession {
  visitorId: string;
  openid: string;
  /** 已绑定的实名身份证号;未绑定为 null(首次预约时经 /api/c/auth/bind 绑定) */
  boundIdCard: string | null;
}

export async function signVisitorToken(payload: {
  visitorId: string;
  openid: string;
  boundIdCard?: string | null;
}): Promise<string> {
  const secret = new TextEncoder().encode(VISITOR_JWT_SECRET);
  return new SignJWT({ openid: payload.openid, boundIdCard: payload.boundIdCard ?? null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.visitorId)
    .setIssuer(VISITOR_JWT_ISSUER)
    .setAudience(VISITOR_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(VISITOR_TOKEN_TTL)
    .sign(secret);
}

export async function verifyVisitorToken(token: string): Promise<VisitorSession | null> {
  try {
    const secret = new TextEncoder().encode(VISITOR_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      issuer: VISITOR_JWT_ISSUER,
      audience: VISITOR_JWT_AUDIENCE,
    });
    if (!payload.sub) return null;
    return {
      visitorId: payload.sub,
      openid: (payload.openid as string | undefined) ?? "",
      boundIdCard: (payload.boundIdCard as string | null | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

/** 从请求头 Authorization: Bearer <token> 解出游客会话;无效/缺失返回 null。 */
export async function getVisitorSession(req: Request): Promise<VisitorSession | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  return verifyVisitorToken(match[1].trim());
}

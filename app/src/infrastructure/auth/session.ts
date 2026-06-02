import { jwtVerify } from "jose";
import { cookies } from "next/headers";

export interface Session {
  userId: string;
  /** 顶层 aud 角色,密码登录恒为 "authenticated"(GoTrue 内置语义,非业务角色) */
  role: string;
  /** E2: 业务角色,来自 JWT app_metadata.role(SUPER_ADMIN/ADMIN/OPERATOR);旧 token 可能为 null */
  appRole: string | null;
  phone?: string;
}

const JWT_SECRET = process.env.GOTRUE_JWT_SECRET ?? "";

const JWT_ISSUER =
  process.env.GOTRUE_JWT_ISSUER ?? process.env.GOTRUE_URL ?? "http://localhost:9999";

export async function getSession(): Promise<Session | null> {
  try {
    const store = await cookies();
    const token =
      store.get("sb-access-token")?.value ?? store.get("access_token")?.value;
    if (!token) return null;

    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { issuer: JWT_ISSUER });

    const sub = payload.sub;
    const role = (payload.role as string | undefined) ?? "authenticated";
    const appMeta = payload.app_metadata as { role?: string } | undefined;
    const appRole = appMeta?.role ?? null;
    const phone = payload.phone as string | undefined;

    if (!sub) return null;
    return { userId: sub, role, appRole, phone };
  } catch {
    return null;
  }
}

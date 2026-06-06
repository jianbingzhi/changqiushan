import type { JWTPayload } from "jose";

// BE-C 会话滑动续期(B16)收口。edge 安全:仅 fetch + 纯计算,无 node/next 专属 API,
// 故登录(node server action)与 middleware(edge)可共用,避免双源漂移。
//
// 双路统一走 GoTrue refresh(不本地重签):自托管 HS256 虽理论可本地重签,但会绕过 GoTrue 的
// ban/吊销语义(banAuthUser 失效),故两环境统一打 GoTrue /token?grant_type=refresh_token。

export const ACCESS_COOKIE = "sb-access-token";
export const REFRESH_COOKIE = "sb-refresh-token";

// 临近过期阈值:access 剩余寿命 < 10min 时主动刷新(窗口够宽,缓解并发刷新竞态)。
export const REFRESH_WINDOW_MS = 10 * 60 * 1000;

export type CookieOptions = {
  httpOnly: true;
  path: "/";
  sameSite: "lax";
  secure: boolean;
  maxAge: number;
};

// B21:secure cookie 在内网 http(VPN)下不回传 → "点登录没反应"。COOKIE_SECURE 显式开关,
// 未设回退 NODE_ENV;内网 http QA 置 false,生产 https 置 true。
export function cookieSecure(): boolean {
  return process.env.COOKIE_SECURE != null
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production";
}

export function accessCookieMaxAge(): number {
  return Number(process.env.GOTRUE_JWT_EXP) || 3600;
}

// refresh token 寿命:GoTrue refresh token 默认不过期,这里给 cookie 一个上限(默认 30 天,可配)。
export function refreshCookieMaxAge(): number {
  return Number(process.env.GOTRUE_REFRESH_TOKEN_EXP) || 60 * 60 * 24 * 30;
}

export function accessCookieOptions(): CookieOptions {
  return { httpOnly: true, path: "/", sameSite: "lax", secure: cookieSecure(), maxAge: accessCookieMaxAge() };
}

export function refreshCookieOptions(): CookieOptions {
  return { httpOnly: true, path: "/", sameSite: "lax", secure: cookieSecure(), maxAge: refreshCookieMaxAge() };
}

/** access token 是否临近过期(或已无有效载荷)需要刷新。 */
export function shouldRefresh(payload: JWTPayload | null): boolean {
  if (!payload) return true;
  if (typeof payload.exp !== "number") return false;
  return payload.exp * 1000 - Date.now() < REFRESH_WINDOW_MS;
}

export type RefreshedSession = { accessToken: string; refreshToken: string };

/**
 * 用 refresh_token 向 GoTrue 换新会话。成功返回新 access + refresh(GoTrue 会轮换 refresh_token,
 * 调用方必须把新返回的两个都写回 cookie);失败(token 失效/被吊销/网络)返回 null,调用方 fail-closed。
 */
export async function refreshSession(refreshToken: string): Promise<RefreshedSession | null> {
  const gotrueUrl = process.env.GOTRUE_URL ?? "http://localhost:9999";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Supabase 云 Auth 网关要求 apikey(anon key);自托管 GoTrue 忽略该头,统一发安全。
  if (process.env.SUPABASE_ANON_KEY) headers["apikey"] = process.env.SUPABASE_ANON_KEY;

  try {
    const res = await fetch(`${gotrueUrl}/token?grant_type=refresh_token`, {
      method: "POST",
      headers,
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; refresh_token?: string };
    if (!data.access_token || !data.refresh_token) return null;
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  } catch {
    return null;
  }
}

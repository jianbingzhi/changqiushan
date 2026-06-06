import { NextResponse } from "next/server";
import type { NextRequest, NextResponse as NextResponseType } from "next/server";
import { ADMIN_UP, SUPER_ONLY } from "@/shared/auth/roles";
import { verifyAccessToken } from "@/shared/auth/jwt-verify";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
  refreshSession,
  shouldRefresh,
  type RefreshedSession,
} from "@/shared/auth/refresh";

const PUBLIC_PATHS = ["/login"];

// 把续期得到的新 access+refresh 两个 cookie 写回响应(GoTrue 会轮换 refresh_token,必须都写回)。
function applyRefreshedCookies(res: NextResponseType, refreshed: RefreshedSession) {
  res.cookies.set(ACCESS_COOKIE, refreshed.accessToken, accessCookieOptions());
  res.cookies.set(REFRESH_COOKIE, refreshed.refreshToken, refreshCookieOptions());
}

// 路由前缀 → 允许角色(粗粒度纵深防御)。真正的强制点在各 action 的 requireRole;
// 此处仅在 edge 层先挡一道,未授权角色访问越权页面直接回首页,不进 RSC。
const ROUTE_ROLE_GATES: { prefix: string; allow: readonly string[] }[] = [
  { prefix: "/system", allow: SUPER_ONLY },
  { prefix: "/analytics", allow: ADMIN_UP },
  { prefix: "/content", allow: ADMIN_UP },
  { prefix: "/riskcontrol", allow: ADMIN_UP },
];

function matchGate(pathname: string) {
  return ROUTE_ROLE_GATES.find(
    (g) => pathname === g.prefix || pathname.startsWith(g.prefix + "/"),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token =
    request.cookies.get(ACCESS_COOKIE)?.value ??
    request.cookies.get("access_token")?.value;

  let payload = token ? await verifyAccessToken(token) : null;

  // B16 滑动续期:access 已失效或临近过期(<10min)且存在 refresh_token → 主动换新会话。
  // 成功则用新 access 的载荷继续,并把新 cookie 写回响应;失败保留旧载荷(若仍有效)。
  let refreshed: RefreshedSession | null = null;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken && shouldRefresh(payload)) {
    refreshed = await refreshSession(refreshToken);
    if (refreshed) {
      const newPayload = await verifyAccessToken(refreshed.accessToken);
      if (newPayload) {
        payload = newPayload;
        // 同一请求的下游 RSC(getSession)也要读到新 token,故同步改写 request cookie。
        request.cookies.set(ACCESS_COOKIE, refreshed.accessToken);
        request.cookies.set(REFRESH_COOKIE, refreshed.refreshToken);
      } else {
        refreshed = null; // 换来的 token 验不过,视同失败
      }
    }
  }

  if (!payload) {
    // fail-closed:无有效会话且续期失败 → 回登录,并清掉过期 cookie 防循环。
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete(ACCESS_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  // 阶段 1: 细粒度 RBAC — 读 JWT app_metadata.role 做路由权限门(纵深防御,不替代 action 层)
  const gate = matchGate(pathname);
  if (gate) {
    const appRole = (payload.app_metadata as { role?: string } | undefined)?.role;
    if (!appRole || !gate.allow.includes(appRole)) {
      const homeUrl = new URL("/", request.url);
      homeUrl.searchParams.set("denied", pathname);
      const res = NextResponse.redirect(homeUrl);
      if (refreshed) applyRefreshedCookies(res, refreshed);
      return res;
    }
  }

  const res = NextResponse.next({ request });
  if (refreshed) applyRefreshedCookies(res, refreshed);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};

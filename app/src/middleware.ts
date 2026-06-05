import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_UP, SUPER_ONLY } from "@/shared/auth/roles";
import { verifyAccessToken } from "@/shared/auth/jwt-verify";

const PUBLIC_PATHS = ["/login"];

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
    request.cookies.get("sb-access-token")?.value ??
    request.cookies.get("access_token")?.value;

  const payload = token ? await verifyAccessToken(token) : null;

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 阶段 1: 细粒度 RBAC — 读 JWT app_metadata.role 做路由权限门(纵深防御,不替代 action 层)
  const gate = matchGate(pathname);
  if (gate) {
    const appRole = (payload.app_metadata as { role?: string } | undefined)?.role;
    if (!appRole || !gate.allow.includes(appRole)) {
      const homeUrl = new URL("/", request.url);
      homeUrl.searchParams.set("denied", pathname);
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};

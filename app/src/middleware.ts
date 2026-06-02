import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login"];
const JWT_SECRET = process.env.GOTRUE_JWT_SECRET ?? "";
// E5: 与 session.ts 保持一致的验签口径,补 issuer 校验,堵同 secret 他服务 token 过粗门
const JWT_ISSUER =
  process.env.GOTRUE_JWT_ISSUER ?? process.env.GOTRUE_URL ?? "http://localhost:9999";

async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    await jwtVerify(token, secret, { issuer: JWT_ISSUER });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token =
    request.cookies.get("sb-access-token")?.value ??
    request.cookies.get("access_token")?.value;

  if (!token || !(await verifyToken(token))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // TODO 阶段 1: 细粒度 RBAC — 读 JWT app_metadata.role 做路由权限门
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};

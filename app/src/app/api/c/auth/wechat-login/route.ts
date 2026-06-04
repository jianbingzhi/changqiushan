import type { NextRequest } from "next/server";
import { wechatAuthService } from "@/modules/wechat";
import { fromResult, badJson, serverError } from "../../_lib/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/c/auth/wechat-login  { code }  → { token, visitorId, boundIdCard }
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badJson();
  }
  try {
    const result = await wechatAuthService.loginByCode(body);
    return fromResult(result);
  } catch (e) {
    console.error("[c/auth/wechat-login] 服务异常:", e);
    return serverError();
  }
}

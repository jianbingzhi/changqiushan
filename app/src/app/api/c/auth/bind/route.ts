import type { NextRequest } from "next/server";
import { wechatAuthService } from "@/modules/wechat";
import { requireVisitor } from "../../_lib/requireVisitor";
import { fromResult, badJson, serverError } from "../../_lib/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/c/auth/bind  { idCard, phone }  → { token, boundIdCard }(绑定后重签 token)
export async function POST(req: NextRequest) {
  const auth = await requireVisitor(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badJson();
  }
  try {
    const result = await wechatAuthService.bindIdentity(auth.session.visitorId, body);
    return fromResult(result);
  } catch (e) {
    console.error("[c/auth/bind] 服务异常:", e);
    return serverError();
  }
}

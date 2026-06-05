import type { NextRequest } from "next/server";
import { riskcontrolService } from "@/modules/riskcontrol";
import { requireBoundVisitor } from "../_lib/requireVisitor";
import { fromResult, badJson, serverError } from "../_lib/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/c/appeals { reason } — 游客对本人黑名单提交申诉(身份证取 token 绑定值)
export async function POST(req: NextRequest) {
  const auth = await requireBoundVisitor(req);
  if (!auth.ok) return auth.response;

  let body: { reason?: unknown };
  try {
    body = (await req.json()) as { reason?: unknown };
  } catch {
    return badJson();
  }
  const reason = typeof body.reason === "string" ? body.reason : "";
  try {
    const result = await riskcontrolService.submitAppealByIdCard(auth.session.boundIdCard, reason);
    return fromResult(result);
  } catch (e) {
    console.error("[c/appeals] 服务异常:", e);
    return serverError();
  }
}

import type { NextRequest } from "next/server";
import { contentService } from "@/modules/content";
import { requireVisitor } from "../../../_lib/requireVisitor";
import { fromResult, badJson, serverError } from "../../../_lib/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/c/activities/:id/signup { userName, idCard, phone } — 免费活动报名(阶段一)
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireVisitor(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badJson();
  }
  try {
    return fromResult(await contentService.createSignup(id, body));
  } catch (e) {
    console.error("[c/activities/:id/signup] 服务异常:", e);
    return serverError();
  }
}

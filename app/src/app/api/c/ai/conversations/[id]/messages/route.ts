import type { NextRequest } from "next/server";
import { aiService } from "@/modules/ai";
import { requireVisitor } from "../../../../_lib/requireVisitor";
import { jsonOk, jsonErr, serverError } from "../../../../_lib/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/c/ai/conversations/:id/messages — 某会话的消息(校验归属)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireVisitor(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const result = await aiService.getMessages(id, auth.session.visitorId);
    if (!result.ok) return jsonErr(result.code, result.message);
    return jsonOk(
      result.value.map((m) => ({
        role: m.role === "USER" ? "user" : "assistant",
        content: m.content,
        createdAt: m.createdAt,
      })),
    );
  } catch (e) {
    console.error("[c/ai/conversations/:id/messages] 服务异常:", e);
    return serverError();
  }
}

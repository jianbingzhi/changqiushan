import type { NextRequest } from "next/server";
import { aiService } from "@/modules/ai";
import { requireVisitor } from "../../_lib/requireVisitor";
import { jsonOk, serverError } from "../../_lib/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/c/ai/conversations — 当前游客的历史会话列表
export async function GET(req: NextRequest) {
  const auth = await requireVisitor(req);
  if (!auth.ok) return auth.response;
  try {
    const list = await aiService.listConversations(auth.session.visitorId);
    return jsonOk(list.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt })));
  } catch (e) {
    console.error("[c/ai/conversations] 服务异常:", e);
    return serverError();
  }
}

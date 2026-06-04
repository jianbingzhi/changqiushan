import type { NextRequest } from "next/server";
import { contentRepository } from "@/modules/content";
import { jsonOk, serverError } from "../_lib/respond";
import { publicKnowledge } from "../_lib/serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/c/knowledge?category= → 已发布知识库(公开读)
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? undefined;
  try {
    const list = await contentRepository.listKnowledge(category || undefined);
    return jsonOk(list.filter((k) => k.status === "PUBLISHED").map(publicKnowledge));
  } catch (e) {
    console.error("[c/knowledge] 服务异常:", e);
    return serverError();
  }
}

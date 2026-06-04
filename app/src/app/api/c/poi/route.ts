import type { NextRequest } from "next/server";
import { contentRepository } from "@/modules/content";
import { jsonOk, serverError } from "../_lib/respond";
import { publicPoi } from "../_lib/serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/c/poi?category= → 已发布导览 POI(公开读,供 A10 标注)
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? undefined;
  try {
    const list = await contentRepository.listPois(category || undefined);
    return jsonOk(list.filter((p) => p.status === "PUBLISHED").map(publicPoi));
  } catch (e) {
    console.error("[c/poi] 服务异常:", e);
    return serverError();
  }
}

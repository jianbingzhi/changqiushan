import { contentRepository } from "@/modules/content";
import { jsonOk, serverError } from "../_lib/respond";
import { publicNews } from "../_lib/serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/c/news → 已发布资讯(公开读)
export async function GET() {
  try {
    const list = await contentRepository.listNews();
    return jsonOk(list.filter((n) => n.status === "PUBLISHED").map(publicNews));
  } catch (e) {
    console.error("[c/news] 服务异常:", e);
    return serverError();
  }
}

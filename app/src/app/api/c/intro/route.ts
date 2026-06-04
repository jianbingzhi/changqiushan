import { contentRepository } from "@/modules/content";
import { jsonOk, serverError } from "../_lib/respond";
import { publicIntro } from "../_lib/serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/c/intro → 已发布景区介绍(公开读)
export async function GET() {
  try {
    const list = await contentRepository.listIntros();
    return jsonOk(list.filter((i) => i.status === "PUBLISHED").map(publicIntro));
  } catch (e) {
    console.error("[c/intro] 服务异常:", e);
    return serverError();
  }
}

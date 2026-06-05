import { contentRepository } from "@/modules/content";
import { jsonOk, serverError } from "../_lib/respond";
import { publicActivity } from "../_lib/serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/c/activities → 已发布活动列表(含报名人数,公开读)
export async function GET() {
  try {
    const list = await contentRepository.listActivitiesWithCounts();
    return jsonOk(list.filter((a) => a.status === "PUBLISHED").map(publicActivity));
  } catch (e) {
    console.error("[c/activities] 服务异常:", e);
    return serverError();
  }
}

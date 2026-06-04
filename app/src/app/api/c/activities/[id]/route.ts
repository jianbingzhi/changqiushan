import type { NextRequest } from "next/server";
import { contentRepository } from "@/modules/content";
import { jsonOk, jsonErr, serverError } from "../../_lib/respond";
import { publicActivity } from "../../_lib/serialize";
import { ErrCode } from "@/shared/result";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/c/activities/:id → 活动详情(公开读,仅已发布)
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const activity = await contentRepository.getActivity(id);
    if (!activity || activity.status !== "PUBLISHED") {
      return jsonErr(ErrCode.NOT_FOUND, "活动不存在或未发布");
    }
    return jsonOk(publicActivity(activity));
  } catch (e) {
    console.error("[c/activities/:id] 服务异常:", e);
    return serverError();
  }
}

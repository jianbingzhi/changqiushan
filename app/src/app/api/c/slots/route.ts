import type { NextRequest } from "next/server";
import { bookingService } from "@/modules/booking";
import { jsonOk, jsonErr, serverError } from "../_lib/respond";
import { publicSlot } from "../_lib/serialize";
import { ErrCode } from "@/shared/result";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/c/slots?date=2026-06-15 → 该日小程序渠道可约时段(公开读,供 A3 轮询)
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonErr(ErrCode.INVALID_INPUT, "日期参数格式应为 2026-06-15");
  }
  try {
    // B34: 派生读路径——游客查时段须含"按规则派生的虚拟时段"(首单惰性物化前),
    // 否则当天无物化行时游客看到空、无法下单(破 B26 端到端自愈)。
    const slots = await bookingService.listSlotsForDate(date);
    return jsonOk(slots.map(publicSlot));
  } catch (e) {
    console.error("[c/slots] 服务异常:", e);
    return serverError();
  }
}

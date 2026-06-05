import { trafficRepository } from "@/modules/traffic";
import { jsonOk, serverError } from "../_lib/respond";
import { publicParkingLot } from "../_lib/serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/c/parking → 停车场实时占用(公开读,供 A10 抽屉 30s 轮询)
export async function GET() {
  try {
    const lots = await trafficRepository.listParkingLots();
    return jsonOk(lots.map(publicParkingLot));
  } catch (e) {
    console.error("[c/parking] 服务异常:", e);
    return serverError();
  }
}

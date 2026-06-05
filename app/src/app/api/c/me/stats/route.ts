import type { NextRequest } from "next/server";
import { bookingService } from "@/modules/booking";
import { requireVisitor } from "../../_lib/requireVisitor";
import { jsonOk, serverError } from "../../_lib/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/c/me/stats — 我的中心聚合(待履约/已核销/爽约/已取消)
export async function GET(req: NextRequest) {
  const auth = await requireVisitor(req);
  if (!auth.ok) return auth.response;

  if (!auth.session.boundIdCard) {
    return jsonOk({ pending: 0, checkedIn: 0, noShow: 0, cancelled: 0, total: 0 });
  }
  try {
    const stats = await bookingService.getVisitorStats(auth.session.boundIdCard);
    return jsonOk(stats);
  } catch (e) {
    console.error("[c/me/stats] 服务异常:", e);
    return serverError();
  }
}

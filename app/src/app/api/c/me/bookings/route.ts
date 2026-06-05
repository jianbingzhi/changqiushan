import type { NextRequest } from "next/server";
import { bookingRepository } from "@/modules/booking";
import { requireVisitor } from "../../_lib/requireVisitor";
import { jsonOk, serverError } from "../../_lib/respond";
import { publicBooking } from "../../_lib/serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/c/me/bookings — 我的预约(精确按 token 绑定身份证,防枚举越权)
export async function GET(req: NextRequest) {
  const auth = await requireVisitor(req);
  if (!auth.ok) return auth.response;

  // 未绑定实名(尚未下过单)→ 空列表
  if (!auth.session.boundIdCard) return jsonOk([]);

  try {
    const list = await bookingRepository.listBookingsByIdCardExact(auth.session.boundIdCard);
    return jsonOk(list.map(publicBooking));
  } catch (e) {
    console.error("[c/me/bookings] 服务异常:", e);
    return serverError();
  }
}

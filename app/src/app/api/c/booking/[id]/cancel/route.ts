import type { NextRequest } from "next/server";
import { bookingService, bookingRepository } from "@/modules/booking";
import { requireVisitor } from "../../../_lib/requireVisitor";
import { jsonOk, jsonErr, serverError } from "../../../_lib/respond";
import { ErrCode } from "@/shared/result";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/c/booking/:id/cancel — 校验归属(token 绑定身份证)后取消
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireVisitor(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    const booking = await bookingRepository.getBookingWithSlot(id);
    if (!booking) return jsonErr(ErrCode.NOT_FOUND, "预约单不存在");
    // 归属校验:只能取消本人(token 绑定身份证)名下的预约
    if (!auth.session.boundIdCard || booking.idCard !== auth.session.boundIdCard) {
      return jsonErr(ErrCode.PERMISSION_DENIED, "无权操作该预约单");
    }
    const result = await bookingService.cancelBooking(id);
    if (!result.ok) return jsonErr(result.code, result.message);
    return jsonOk({ id, status: "CANCELLED" });
  } catch (e) {
    console.error("[c/booking/:id/cancel] 服务异常:", e);
    return serverError();
  }
}

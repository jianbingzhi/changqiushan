import type { NextRequest } from "next/server";
import { checkinService } from "@/modules/checkin";
import { requireBoundVisitor } from "../_lib/requireVisitor";
import { fromResult, jsonErr, serverError } from "../_lib/respond";
import { ErrCode } from "@/shared/result";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/c/checkin-code?bookingId= — 当前 30s 动态核销码(校验归属,不返回 secret)
export async function GET(req: NextRequest) {
  const auth = await requireBoundVisitor(req);
  if (!auth.ok) return auth.response;

  const bookingId = req.nextUrl.searchParams.get("bookingId") ?? "";
  if (!bookingId) return jsonErr(ErrCode.INVALID_INPUT, "缺少预约单号");

  try {
    // 归属主体取 token 绑定身份证,防越权拉他人核销码
    const result = await checkinService.getCurrentCheckinCode(bookingId, auth.session.boundIdCard);
    return fromResult(result);
  } catch (e) {
    console.error("[c/checkin-code] 服务异常:", e);
    return serverError();
  }
}

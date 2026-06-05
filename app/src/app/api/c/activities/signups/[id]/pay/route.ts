import type { NextRequest } from "next/server";
import { contentRepository } from "@/modules/content";
import { paymentService } from "@/modules/payment";
import { requireVisitor } from "../../../../_lib/requireVisitor";
import { fromResult, jsonErr, serverError } from "../../../../_lib/respond";
import { ErrCode } from "@/shared/result";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/c/activities/signups/:id/pay — 付费活动报名 JSAPI 下单(金额取 registrationFee)
// 跨模块组合在 app 层:content 读金额 → payment 下单;payment 不依赖 content
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireVisitor(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    const signup = await contentRepository.getSignup(id);
    if (!signup) return jsonErr(ErrCode.NOT_FOUND, "报名记录不存在");
    if (signup.paymentStatus === "PAID") return jsonErr(ErrCode.INVALID_INPUT, "该报名已支付");

    const activity = await contentRepository.getActivity(signup.activityId);
    if (!activity) return jsonErr(ErrCode.NOT_FOUND, "活动不存在");
    const fee = Number(activity.registrationFee.toString());
    if (fee <= 0) return jsonErr(ErrCode.INVALID_INPUT, "该活动免费，无需支付");

    const result = await paymentService.createJsapiOrder({
      outTradeNo: id,
      amountFen: Math.round(fee * 100),
      description: `活动报名费：${activity.title}`,
      openid: auth.session.openid,
    });
    return fromResult(result);
  } catch (e) {
    console.error("[c/activities/signups/:id/pay] 服务异常:", e);
    return serverError();
  }
}

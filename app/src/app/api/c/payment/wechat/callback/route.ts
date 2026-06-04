import type { NextRequest } from "next/server";
import { paymentService } from "@/modules/payment";
import { contentService, contentRepository } from "@/modules/content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/c/payment/wechat/callback — 微信支付结果通知
// 无游客鉴权(靠微信 APIv3 验签);幂等 + 金额二次校验 + 经 content.markSignupPaid 写状态
// 与 booking 物理隔离:本路由绝不触碰入园预约
function wxAck(code: "SUCCESS" | "FAIL", message: string, status = 200): Response {
  return Response.json({ code, message }, { status });
}

// 可选边缘 IP ACL(配置 WXPAY_CALLBACK_IPS 逗号分隔时生效)
function ipAllowed(req: NextRequest): boolean {
  const allow = (process.env.WXPAY_CALLBACK_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allow.length === 0) return true;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return allow.includes(ip);
}

export async function POST(req: NextRequest) {
  if (!ipAllowed(req)) return wxAck("FAIL", "来源不可信", 403);

  const rawBody = await req.text();
  const headers = {
    timestamp: req.headers.get("Wechatpay-Timestamp") ?? "",
    nonce: req.headers.get("Wechatpay-Nonce") ?? "",
    signature: req.headers.get("Wechatpay-Signature") ?? "",
  };

  const cb = paymentService.handleCallback(headers, rawBody);
  if (!cb.ok) return wxAck("FAIL", cb.message, 401);

  const { outTradeNo, transactionId, amountTotal, tradeState } = cb.value;
  if (tradeState !== "SUCCESS") return wxAck("SUCCESS", "已接收"); // 非成功态直接确认收单

  try {
    // 金额二次校验 = registrationFee(分)
    const signup = await contentRepository.getSignup(outTradeNo);
    if (!signup) return wxAck("FAIL", "报名不存在", 404);
    const activity = await contentRepository.getActivity(signup.activityId);
    const expectFen = activity ? Math.round(Number(activity.registrationFee.toString()) * 100) : -1;
    if (amountTotal !== expectFen) return wxAck("FAIL", "金额校验不通过", 400);

    // 幂等写(markSignupPaid 内部判重 + wx_transaction_id 唯一索引兜底)
    await contentService.markSignupPaid(outTradeNo, { wxTransactionId: transactionId });
    return wxAck("SUCCESS", "成功");
  } catch (e) {
    console.error("[c/payment/wechat/callback] 服务异常:", e);
    return wxAck("FAIL", "处理失败", 500);
  }
}

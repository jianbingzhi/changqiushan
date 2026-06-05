import {
  createJsapiOrder,
  verifyAndDecryptCallback,
  type JsapiPayParams,
  type CallbackResult,
} from "@/infrastructure/wxpay/client";
import { ok, err, ErrCode, type Result } from "@/shared/result";

// 微信支付模块:仅活动报名费二消;不依赖 booking、不跨写 content 表(跨模块组合在 app 路由层)
export const paymentService = {
  // JSAPI 下单 → 返回小程序 requestPayment 参数;金额由调用方(app 层)从 registrationFee 取定
  async createJsapiOrder(input: {
    outTradeNo: string;
    amountFen: number;
    description: string;
    openid: string;
  }): Promise<Result<JsapiPayParams>> {
    if (input.amountFen <= 0) return err(ErrCode.INVALID_INPUT, "支付金额无效");
    const r = await createJsapiOrder(input);
    if (!r.ok) return err(ErrCode.EXTERNAL_SERVICE_ERROR, r.message);
    return ok(r.params);
  },

  // 回调验签+解密 → 返回交易结果;幂等与金额二次校验由 app 路由层结合 content 完成
  handleCallback(
    headers: { timestamp: string; nonce: string; signature: string },
    rawBody: string,
  ): Result<CallbackResult> {
    const r = verifyAndDecryptCallback(headers, rawBody);
    if (!r.ok) return err(ErrCode.PERMISSION_DENIED, r.message);
    return ok(r.result);
  },
};

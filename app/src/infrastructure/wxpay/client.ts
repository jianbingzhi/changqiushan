// 微信支付 APIv3 client(JSAPI 下单 + 回调验签解密)
// 仅服务端;商户私钥/APIv3 密钥/平台证书绝不下发。放 infrastructure(module-internal 可依赖)
// 注:仅用于「活动报名费」二消场景;入园主流程绝不调用(支付链路隔离红线)
import {
  createSign,
  createVerify,
  createDecipheriv,
  randomBytes,
} from "crypto";
import { getWxPayCredentials } from "@/infrastructure/config/integration";

const JSAPI_URL = "https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi";
const JSAPI_PATH = "/v3/pay/transactions/jsapi";

export interface JsapiPayParams {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string; // prepay_id=...
  signType: "RSA";
  paySign: string;
}

export interface CallbackResult {
  outTradeNo: string;
  transactionId: string;
  amountTotal: number; // 分
  tradeState: string;
}

function rsaSign(content: string, privateKey: string): string {
  return createSign("RSA-SHA256").update(content).sign(privateKey, "base64");
}

function nonce(): string {
  return randomBytes(16).toString("hex");
}

/** JSAPI 下单 → 返回小程序 requestPayment 所需参数(含 paySign) */
export async function createJsapiOrder(input: {
  outTradeNo: string;
  amountFen: number;
  description: string;
  openid: string;
}): Promise<{ ok: true; params: JsapiPayParams } | { ok: false; message: string }> {
  const c = getWxPayCredentials();
  if (!c.mchId || !c.privateKey || !c.serialNo || !c.notifyUrl) {
    return { ok: false, message: "支付功能暂未配置" };
  }

  const body = JSON.stringify({
    appid: c.appId,
    mchid: c.mchId,
    description: input.description,
    out_trade_no: input.outTradeNo,
    notify_url: c.notifyUrl,
    amount: { total: input.amountFen, currency: "CNY" },
    payer: { openid: input.openid },
  });

  const ts = Math.floor(Date.now() / 1000).toString();
  const non = nonce();
  const signStr = `POST\n${JSAPI_PATH}\n${ts}\n${non}\n${body}\n`;
  const signature = rsaSign(signStr, c.privateKey);
  const auth =
    `WECHATPAY2-SHA256-RSA2048 mchid="${c.mchId}",nonce_str="${non}",` +
    `signature="${signature}",timestamp="${ts}",serial_no="${c.serialNo}"`;

  let prepayId: string;
  try {
    const res = await fetch(JSAPI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: auth,
      },
      body,
    });
    const json = (await res.json()) as { prepay_id?: string; message?: string };
    if (!json.prepay_id) return { ok: false, message: json.message ?? "下单失败" };
    prepayId = json.prepay_id;
  } catch {
    return { ok: false, message: "支付服务暂不可用" };
  }

  // 构造小程序 requestPayment 的 paySign(签名串:appId\ntimestamp\nnonce\npackage\n)
  const payTs = Math.floor(Date.now() / 1000).toString();
  const payNonce = nonce();
  const pkg = `prepay_id=${prepayId}`;
  const paySign = rsaSign(`${c.appId}\n${payTs}\n${payNonce}\n${pkg}\n`, c.privateKey);

  return {
    ok: true,
    params: {
      appId: c.appId,
      timeStamp: payTs,
      nonceStr: payNonce,
      package: pkg,
      signType: "RSA",
      paySign,
    },
  };
}

/** 回调验签(平台证书公钥)+ AES-256-GCM 解密 resource → 交易结果 */
export function verifyAndDecryptCallback(
  headers: { timestamp: string; nonce: string; signature: string },
  rawBody: string,
): { ok: true; result: CallbackResult } | { ok: false; message: string } {
  const c = getWxPayCredentials();
  if (!c.apiV3Key || !c.platformPublicKey) {
    return { ok: false, message: "支付回调未配置" };
  }

  // 1) 验签:timestamp\nnonce\nbody\n
  const signStr = `${headers.timestamp}\n${headers.nonce}\n${rawBody}\n`;
  const verified = createVerify("RSA-SHA256")
    .update(signStr)
    .verify(c.platformPublicKey, headers.signature, "base64");
  if (!verified) return { ok: false, message: "回调验签失败" };

  // 2) 解密 resource(AES-256-GCM)
  let decrypted: string;
  try {
    const payload = JSON.parse(rawBody) as {
      resource?: { ciphertext: string; nonce: string; associated_data?: string };
    };
    const r = payload.resource;
    if (!r) return { ok: false, message: "回调缺少 resource" };
    const data = Buffer.from(r.ciphertext, "base64");
    const authTag = data.subarray(data.length - 16);
    const cipher = data.subarray(0, data.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(c.apiV3Key), Buffer.from(r.nonce));
    decipher.setAuthTag(authTag);
    if (r.associated_data) decipher.setAAD(Buffer.from(r.associated_data));
    decrypted = Buffer.concat([decipher.update(cipher), decipher.final()]).toString("utf8");
  } catch {
    return { ok: false, message: "回调解密失败" };
  }

  try {
    const obj = JSON.parse(decrypted) as {
      out_trade_no: string;
      transaction_id: string;
      trade_state: string;
      amount?: { total?: number };
    };
    return {
      ok: true,
      result: {
        outTradeNo: obj.out_trade_no,
        transactionId: obj.transaction_id,
        amountTotal: obj.amount?.total ?? 0,
        tradeState: obj.trade_state,
      },
    };
  } catch {
    return { ok: false, message: "回调内容解析失败" };
  }
}

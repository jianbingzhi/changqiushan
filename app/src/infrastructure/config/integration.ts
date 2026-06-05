// 集成配置中心(占位实现)
// 第三方密钥(微信 AppSecret / 支付 mch / AI key / 存储 key)一律服务端读取,
// 绝不下发前端(红线#7)。上线切真正的配置中心/密钥管理服务时,仅替换本文件实现,接口不变。

export interface WechatCredentials {
  appId: string;
  secret: string;
}

/** 读取微信小程序 AppID / AppSecret。仅服务端调用,返回值绝不进入任何 C 端响应体。 */
export function getWechatCredentials(): WechatCredentials {
  return {
    appId: process.env.WECHAT_APPID ?? "",
    secret: process.env.WECHAT_SECRET ?? "",
  };
}

export interface AiCredentials {
  baseURL: string;
  model: string;
  apiKey: string;
}

/** 读取大模型 API 凭据(OpenAI 兼容)。仅服务端调用,key 绝不下发前端。 */
export function getAiCredentials(): AiCredentials {
  return {
    baseURL: process.env.AI_BASE_URL ?? "",
    model: process.env.AI_MODEL ?? "",
    apiKey: process.env.AI_API_KEY ?? "",
  };
}

export interface WxPayCredentials {
  appId: string;
  mchId: string;
  serialNo: string;
  /** 商户 API 私钥(PEM);仅服务端持有 */
  privateKey: string;
  /** APIv3 密钥(32 字节),用于回调 AES-256-GCM 解密 */
  apiV3Key: string;
  /** 微信支付平台证书公钥(PEM),用于回调验签 */
  platformPublicKey: string;
  /** 支付结果通知地址(已备案 https) */
  notifyUrl: string;
}

/** 读取微信支付 APIv3 凭据(活动报名费,隔离)。证书/密钥仅服务端持有,绝不下发。 */
export function getWxPayCredentials(): WxPayCredentials {
  return {
    appId: process.env.WECHAT_APPID ?? "",
    mchId: process.env.WXPAY_MCH_ID ?? "",
    serialNo: process.env.WXPAY_SERIAL_NO ?? "",
    privateKey: (process.env.WXPAY_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    apiV3Key: process.env.WXPAY_API_V3_KEY ?? "",
    platformPublicKey: (process.env.WXPAY_PLATFORM_PUBLIC_KEY ?? "").replace(/\\n/g, "\n"),
    notifyUrl: process.env.WXPAY_NOTIFY_URL ?? "",
  };
}

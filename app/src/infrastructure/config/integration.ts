// 集成配置中心(占位实现)
// 第三方密钥(微信 AppSecret / 支付 mch / AI key / 存储 key)一律服务端读取,
// 绝不下发前端(红线#7)。上线切真正的配置中心/密钥管理服务时,仅替换本文件实现,接口不变。
import "server-only"; // 误在客户端组件引入即编译期报错,兜底防密钥进客户端包。

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

export interface StorageCredentials {
  /** 服务端自用端点(docker 内网如 http://minio:9000) */
  endpoint: string;
  /** 浏览器直传/预签名用端点(主机可达如 http://localhost:9000);默认回退 endpoint */
  publicEndpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  /** MinIO/Supabase 需 path-style(true);OSS/COS 视设定 */
  forcePathStyle: boolean;
  /** 公网读基址(CDN/桶域名);留空则由 publicEndpoint+bucket 拼 path-style URL */
  publicBaseUrl: string;
}

/** 读取 S3 兼容存储凭据(MinIO 本地 / Supabase 临时 / 阿里云 OSS 生产,仅改 env 切端点)。仅服务端调用。 */
export function getStorageCredentials(): StorageCredentials {
  const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
  return {
    endpoint,
    // docker 内网与浏览器端点不同时(minio:9000 vs localhost:9000),预签名须用主机可达端点。
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? endpoint,
    region: process.env.S3_REGION ?? "us-east-1",
    accessKey: process.env.S3_ACCESS_KEY ?? "",
    secretKey: process.env.S3_SECRET_KEY ?? "",
    bucket: process.env.S3_BUCKET ?? "changqiushan-media",
    forcePathStyle:
      process.env.S3_FORCE_PATH_STYLE != null
        ? process.env.S3_FORCE_PATH_STYLE === "true"
        : true,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? "",
  };
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

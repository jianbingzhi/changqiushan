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

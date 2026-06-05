// 枚举码 → 中文标签收口。消除 export / 来源分析 / 预约单查询 各自重复的渠道 map,
// 并统一 OTA 的三种写法(D7:统一为「第三方平台」)。UI 与导出列一律走这里。

export const CHANNEL_LABELS: Record<string, string> = {
  MINI_PROGRAM:  "微信小程序",
  ONSITE_MAKEUP: "现场补录",
  OTA:           "第三方平台",
  ADMIN_MANUAL:  "后台代录",
};

export function channelLabel(code: string): string {
  return CHANNEL_LABELS[code] ?? code;
}

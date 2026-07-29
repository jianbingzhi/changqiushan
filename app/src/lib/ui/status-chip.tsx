// 全站状态徽章。被 13 个后台页面共用,所以配色只能走语义 token,不能写死 hex。
//
// round-01 N16(人工在 /traffic/parking 看到「白底绿字看不清」,验收方核实后定为全站问题):
// 旧版 21 个条目每条写死 bg/text/border 三个浅色 hex(共 15 种色),后果有二——
//   ① 深浅两主题下 computed 值完全一致 = 根本不跟随主题,深色卡片上是一颗颗亮片;
//   ② 实底色直接当文字色用,浅底上对比度只有 开放 3.15:1 / 已满 4.41:1,都低于 WCAG AA 4.5:1(12px 小字更吃对比度)。
// 人工当场定的修法:整表换语义 token,一次同时解决两个问题、13 个页面同时受益;
// 明确不采纳「只修停车场那一页」——另外 12 个页面的徽章还是亮片,下次换页还会再报一次。
//
// 21 个状态收敛到 5 个语义色调,每个色调只有一处配色定义(下面的 TONE_CLASS):
// 底/描边用 bg-*/10 · border-*/30(与 booking/channels、booking/onsite 等既有面板同款),
// 文字用 text-*-strong ——「淡底上的文字」专用那一档 token,取值口径见 globals.css,
// 由 status-chip.contrast.test.ts 逐条守着深浅两主题都 ≥ 4.5:1。

type StatusKey =
  // 通用 / 预约 / 风控(原有键,勿改语义)
  | "ACTIVE"
  | "CONFIRMED"
  | "PAUSED"
  | "CLOSED"
  | "CANCELLED"
  | "PENDING"
  | "CHECKED_IN"
  | "BLACKLISTED"
  | "CIRCUIT_BREAK"
  // 设备
  | "DEVICE_ONLINE"
  | "DEVICE_OFFLINE"
  | "DEVICE_ALERT"
  // 路况
  | "ROAD_SMOOTH"
  | "ROAD_SLOW"
  | "ROAD_JAM"
  // 内容
  | "DRAFT"
  | "PUBLISHED_OK"
  | "OFFLINE_CONTENT"
  // 停车
  | "LOT_OPEN"
  | "LOT_FULL"
  | "LOT_CLOSED";

/** 语义色调:好(绿)/ 需注意(橙)/ 异常(红)/ 提示(蓝)/ 中性(灰) */
type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusChipProps {
  status: StatusKey;
}

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-success/10 text-success-strong border-success/30",
  warning: "bg-warning/10 text-warning-strong border-warning/30",
  danger:  "bg-danger/10  text-danger-strong  border-danger/30",
  info:    "bg-info/10    text-info-strong    border-info/30",
  neutral: "bg-muted      text-muted-strong   border-border",
};

const STATUS_CONFIG: Record<StatusKey, { label: string; tone: StatusTone }> = {
  ACTIVE:        { label: "启用",   tone: "success" },
  CONFIRMED:     { label: "已预约", tone: "success" },
  PAUSED:        { label: "已暂停", tone: "neutral" },
  CLOSED:        { label: "已关闭", tone: "neutral" },
  CANCELLED:     { label: "已取消", tone: "neutral" },
  PENDING:       { label: "待审核", tone: "warning" },
  CHECKED_IN:    { label: "已核销", tone: "info" },
  BLACKLISTED:   { label: "已拉黑", tone: "danger" },
  CIRCUIT_BREAK: { label: "熔断中", tone: "danger" },
  // 设备(告警红 / 离线灰,文字明确区分,不靠颜色)
  DEVICE_ONLINE:   { label: "在线", tone: "success" },
  DEVICE_OFFLINE:  { label: "离线", tone: "neutral" },
  DEVICE_ALERT:    { label: "告警", tone: "danger" },
  // 路况
  ROAD_SMOOTH:     { label: "畅通", tone: "success" },
  ROAD_SLOW:       { label: "缓行", tone: "warning" },
  ROAD_JAM:        { label: "拥堵", tone: "danger" },
  // 内容
  DRAFT:           { label: "草稿",   tone: "neutral" },
  PUBLISHED_OK:    { label: "已发布", tone: "success" },
  OFFLINE_CONTENT: { label: "已下线", tone: "neutral" },
  // 停车
  LOT_OPEN:        { label: "开放", tone: "success" },
  LOT_FULL:        { label: "已满", tone: "danger" },
  LOT_CLOSED:      { label: "关闭", tone: "neutral" },
};

export function StatusChip({ status }: StatusChipProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[cfg.tone]}`}
    >
      {cfg.label}
    </span>
  );
}

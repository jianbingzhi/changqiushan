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

interface StatusChipProps {
  status: StatusKey;
}

const STATUS_CONFIG: Record<
  StatusKey,
  { label: string; bg: string; text: string; border: string }
> = {
  ACTIVE:        { label: "启用",   bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
  CONFIRMED:     { label: "已预约", bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
  PAUSED:        { label: "已暂停", bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB" },
  CLOSED:        { label: "已关闭", bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB" },
  CANCELLED:     { label: "已取消", bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB" },
  PENDING:       { label: "待审核", bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
  CHECKED_IN:    { label: "已核销", bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  BLACKLISTED:   { label: "已拉黑", bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  CIRCUIT_BREAK: { label: "熔断中", bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  // 设备(告警红 / 离线灰,文字明确区分,不靠颜色)
  DEVICE_ONLINE:   { label: "在线", bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
  DEVICE_OFFLINE:  { label: "离线", bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB" },
  DEVICE_ALERT:    { label: "告警", bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  // 路况
  ROAD_SMOOTH:     { label: "畅通", bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
  ROAD_SLOW:       { label: "缓行", bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
  ROAD_JAM:        { label: "拥堵", bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  // 内容
  DRAFT:           { label: "草稿",   bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB" },
  PUBLISHED_OK:    { label: "已发布", bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
  OFFLINE_CONTENT: { label: "已下线", bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB" },
  // 停车
  LOT_OPEN:        { label: "开放", bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
  LOT_FULL:        { label: "已满", bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  LOT_CLOSED:      { label: "关闭", bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB" },
};

export function StatusChip({ status }: StatusChipProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border"
      style={{ backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      {cfg.label}
    </span>
  );
}

type StatusKey =
  | "ACTIVE"
  | "CONFIRMED"
  | "PAUSED"
  | "CANCELLED"
  | "PENDING"
  | "CHECKED_IN"
  | "BLACKLISTED"
  | "CIRCUIT_BREAK";

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
  CANCELLED:     { label: "已取消", bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB" },
  PENDING:       { label: "待审核", bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
  CHECKED_IN:    { label: "已核销", bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  BLACKLISTED:   { label: "已拉黑", bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  CIRCUIT_BREAK: { label: "熔断中", bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
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

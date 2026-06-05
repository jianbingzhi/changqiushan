// 预约状态中文映射 + 通用格式化

export const BOOKING_STATUS_TEXT: Record<string, string> = {
  CONFIRMED: "待履约",
  CHECKED_IN: "已核销",
  CANCELLED: "已取消",
  NO_SHOW: "已爽约",
  EXPIRED: "已过期",
};

export const BOOKING_STATUS_TONE: Record<string, "brand" | "success" | "muted" | "danger"> = {
  CONFIRMED: "brand",
  CHECKED_IN: "success",
  CANCELLED: "muted",
  NO_SHOW: "danger",
  EXPIRED: "muted",
};

export const SLOT_STATUS_TEXT: Record<string, string> = {
  ACTIVE: "可预约",
  PAUSED: "已暂停",
  CLOSED: "已关闭",
};

export function maskIdCard(idCard: string): string {
  if (!idCard || idCard.length < 8) return "****";
  return idCard.slice(0, 4) + "*".repeat(idCard.length - 8) + idCard.slice(-4);
}

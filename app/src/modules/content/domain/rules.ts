import type { ContentStatus } from "@prisma/client";

export function canPublish(status: ContentStatus): boolean {
  return status === "DRAFT";
}

export function canArchive(status: ContentStatus): boolean {
  return status === "PUBLISHED";
}

// 架构边界文档注释: B 端不触发支付,仅存储/展示 C 端同步的支付状态
export const PAYMENT_BOUNDARY_NOTE = "B端不触发支付,仅存储/展示支付状态";

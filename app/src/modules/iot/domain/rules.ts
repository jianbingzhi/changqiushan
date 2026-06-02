export const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000;

export function isDeviceOffline(
  lastSeen: Date | null,
  now: Date,
  timeoutMs = HEARTBEAT_TIMEOUT_MS,
): boolean {
  if (!lastSeen) return true;
  return now.getTime() - lastSeen.getTime() > timeoutMs;
}

export function classifyLatency(ms: number): "正常" | "轻微延迟" | "高延迟" {
  if (ms < 100) return "正常";
  if (ms < 300) return "轻微延迟";
  return "高延迟";
}

export function classifySignal(dBm: number | null): "强" | "中" | "弱" | "无信号" {
  if (dBm === null) return "无信号";
  if (dBm >= -60) return "强";
  if (dBm >= -75) return "中";
  return "弱";
}

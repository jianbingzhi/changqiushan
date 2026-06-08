"use client";

import { LiveDot } from "@/lib/ui/live-dot";

export type DataSourceState = "live" | "polling" | "snapshot" | "disconnected";

const STATE_MAP: Record<DataSourceState, { tone: "connected" | "online" | "offline" | "disconnected"; label: string }> = {
  live: { tone: "connected", label: "实时连接正常" },
  polling: { tone: "online", label: "数据轮询中" },
  snapshot: { tone: "offline", label: "数据快照" },
  disconnected: { tone: "disconnected", label: "连接断开" },
};

// 数据源状态条:复用 LiveDot(色 + 中文标签双编码)。可附最近刷新时刻。
export function ScreenStatusBar({ state, updatedAt }: { state: DataSourceState; updatedAt?: string }) {
  const cfg = STATE_MAP[state];
  return (
    <span className="flex items-center gap-2 text-[14px]" style={{ color: "var(--screen-text-dim)" }}>
      <LiveDot tone={cfg.tone} label={cfg.label} />
      {cfg.label}
      {updatedAt && <span className="tabular-nums">· 更新于 {updatedAt}</span>}
    </span>
  );
}

"use client";

import { Maximize, Mountain } from "lucide-react";
import { useCnClock } from "./use-cn-clock";
import { ScreenStatusBar, type DataSourceState } from "./ScreenStatusBar";

interface Props {
  title: string;
  /** 数据源状态(默认「数据快照」) */
  dataSource?: DataSourceState;
  /** 右侧额外内容(如天气小卡),置于状态条左侧 */
  rightExtra?: React.ReactNode;
}

function enterFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void el.requestFullscreen?.();
}

// 大屏统一标题栏(高 72):左 Logo+墙钟 / 中 大标题 / 右 天气?+数据源状态+全屏。
export function ScreenHeader({ title, dataSource = "snapshot", rightExtra }: Props) {
  const clock = useCnClock(true);
  return (
    <header
      className="relative flex h-[72px] items-center justify-between px-8"
      style={{ borderBottom: "1px solid var(--screen-card-border)" }}
    >
      {/* 左:Logo + 墙钟 */}
      <div className="flex items-center gap-3" style={{ minWidth: 360 }}>
        <Mountain size={28} style={{ color: "var(--screen-glow)", filter: "drop-shadow(var(--screen-glow-shadow))" }} />
        <div className="leading-tight">
          <div className="text-[15px] tabular-nums" style={{ color: "var(--screen-text)" }}>
            {clock.date}
          </div>
          <div className="text-[20px] font-bold tabular-nums" style={{ color: "var(--screen-highlight)" }}>
            {clock.time}
          </div>
        </div>
      </div>

      {/* 中:大标题 */}
      <h1
        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[30px] font-bold tracking-wide"
        style={{ color: "var(--screen-highlight)", textShadow: "var(--screen-glow-shadow)" }}
      >
        {title}
      </h1>

      {/* 右:天气? + 数据源状态 + 全屏 */}
      <div className="flex items-center justify-end gap-5" style={{ minWidth: 360 }}>
        {rightExtra}
        <ScreenStatusBar state={dataSource} />
        <button
          type="button"
          onClick={enterFullscreen}
          aria-label="全屏切换"
          title="全屏切换"
          className="rounded p-1.5 transition hover:bg-white/10"
          style={{ color: "var(--screen-text-dim)" }}
        >
          <Maximize size={20} />
        </button>
      </div>
    </header>
  );
}

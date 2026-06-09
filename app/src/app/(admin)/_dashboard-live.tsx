"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { LiveDot } from "@/lib/ui/live-dot";
import { REALTIME_ENABLED } from "@/lib/realtime-flag";
import { getOccupancySnapshot } from "./_dashboard-actions";

interface LiveState {
  connected: boolean;
  count: number;
  /** 手动刷新在园数(实时关闭时用) */
  refresh: () => void;
}

const DashboardLiveContext = createContext<LiveState>({
  connected: false,
  count: 0,
  refresh: () => {},
});

export function DashboardLiveProvider({
  initialCount,
  children,
}: {
  initialCount: number;
  children: ReactNode;
}) {
  const [count, setCount] = useState(initialCount);
  const [connected, setConnected] = useState(false);

  const refresh = () => {
    void getOccupancySnapshot()
      .then((c) => setCount(c))
      .catch(() => {});
  };

  useEffect(() => {
    // 实时关闭(Vercel serverless):不建 EventSource,只用 SSR 首屏 + 手动刷新。
    if (!REALTIME_ENABLED) return;

    const es = new EventSource("/api/sse/checkin_event");
    let timer: ReturnType<typeof setTimeout> | null = null;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = () => {
      // 脏信号:收到任意核销事件即回拉最新在园数(不依赖事件 payload 形状);
      // 尾部去抖,核销高峰下合并连发事件为一次查询
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void getOccupancySnapshot()
          .then((c) => setCount(c))
          .catch(() => {});
      }, 400);
    };
    return () => {
      if (timer) clearTimeout(timer);
      es.close();
    };
  }, []);

  return (
    <DashboardLiveContext.Provider value={{ connected, count, refresh }}>
      {children}
    </DashboardLiveContext.Provider>
  );
}

export const useDashboardLive = () => useContext(DashboardLiveContext);

// 顶部连接态指示(B5):实时开 → 由真实 EventSource onopen/onerror 驱动;
// 实时关 → 显示"数据快照(手动刷新)"+ 刷新按钮,不误导为"连接断开"。
export function HeaderLive() {
  const { connected, refresh } = useDashboardLive();

  if (!REALTIME_ENABLED) {
    return (
      <div className="flex items-center gap-2">
        <LiveDot tone="offline" label="数据快照" />
        <span className="text-[13px] text-muted-foreground">数据快照</span>
        <button
          type="button"
          onClick={refresh}
          className="text-[13px] text-primary hover:underline"
        >
          刷新
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <LiveDot tone={connected ? "connected" : "disconnected"} />
      <span className="text-[13px] text-muted-foreground">
        {connected ? "实时连接正常" : "实时连接断开"}
      </span>
    </div>
  );
}

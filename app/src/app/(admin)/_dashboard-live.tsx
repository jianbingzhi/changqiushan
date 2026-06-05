"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { LiveDot } from "@/lib/ui/live-dot";
import { getOccupancySnapshot } from "./_dashboard-actions";

interface LiveState {
  connected: boolean;
  count: number;
}

const DashboardLiveContext = createContext<LiveState>({
  connected: false,
  count: 0,
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

  useEffect(() => {
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
    <DashboardLiveContext.Provider value={{ connected, count }}>
      {children}
    </DashboardLiveContext.Provider>
  );
}

export const useDashboardLive = () => useContext(DashboardLiveContext);

// 顶部实时连接态指示(B5):由真实 EventSource onopen/onerror 驱动,不再写死。
export function HeaderLive() {
  const { connected } = useDashboardLive();
  return (
    <div className="flex items-center gap-2">
      <LiveDot tone={connected ? "connected" : "disconnected"} />
      <span className="text-[13px] text-[#6B7280]">
        {connected ? "实时连接正常" : "实时连接断开"}
      </span>
    </div>
  );
}

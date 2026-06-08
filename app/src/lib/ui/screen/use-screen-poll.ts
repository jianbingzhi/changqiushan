"use client";

import { useEffect, useRef, useState } from "react";
import type { DataSourceState } from "./ScreenStatusBar";

interface PollResult<T> {
  data: T;
  /** 数据源状态(供 ScreenStatusBar) */
  state: DataSourceState;
  /** 最近成功刷新的北京墙钟时刻 hh:mm:ss */
  updatedAt: string;
}

// 大屏轮询:每 intervalMs 拉一次 /api/screen/[metric],失败保留上次值并标记 disconnected。
// initial 为 RSC 首屏直读的初值(首次渲染即有数据,无闪烁)。
export function useScreenPoll<T>(metric: string, initial: T, intervalMs = 20_000): PollResult<T> {
  const [data, setData] = useState<T>(initial);
  const [state, setState] = useState<DataSourceState>("snapshot");
  const [updatedAt, setUpdatedAt] = useState("");
  const aborted = useRef(false);

  useEffect(() => {
    aborted.current = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/screen/${metric}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as T;
        if (aborted.current) return;
        setData(json);
        setState("polling");
        setUpdatedAt(
          new Intl.DateTimeFormat("zh-CN", {
            timeZone: "Asia/Shanghai",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).format(new Date()),
        );
      } catch {
        if (!aborted.current) setState("disconnected");
      }
    };
    void tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      aborted.current = true;
      clearInterval(id);
    };
  }, [metric, intervalMs]);

  return { data, state, updatedAt };
}

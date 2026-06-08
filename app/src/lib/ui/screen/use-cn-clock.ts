"use client";

import { useEffect, useState } from "react";

export interface CnClock {
  /** 「2026 年 5 月 31 日 周三」 */
  date: string;
  /** 「09:42:18」或「09:42」(withSeconds=false) */
  time: string;
  /** 整串「2026 年 5 月 31 日 周三 09:42:18」 */
  full: string;
}

// 北京墙钟,避免大屏部署在异地服务器/浏览器导致偏差。从 realtime/_big-screen 抽出共享。
// 禁 ISO:日期一律「YYYY 年 M 月 D 日 周X」中文格式(红线 6)。
export function useCnClock(withSeconds = true): CnClock {
  const [clock, setClock] = useState<CnClock>({ date: "", time: "", full: "" });

  useEffect(() => {
    const fmt = () => {
      const parts = new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        second: withSeconds ? "2-digit" : undefined,
        hour12: false,
      }).formatToParts(new Date());
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      const date = `${get("year")} 年 ${get("month")} 月 ${get("day")} 日 ${get("weekday")}`;
      const time = withSeconds
        ? `${get("hour")}:${get("minute")}:${get("second")}`
        : `${get("hour")}:${get("minute")}`;
      setClock({ date, time, full: `${date} ${time}` });
    };
    fmt();
    const id = setInterval(fmt, withSeconds ? 1000 : 15_000);
    return () => clearInterval(id);
  }, [withSeconds]);

  return clock;
}

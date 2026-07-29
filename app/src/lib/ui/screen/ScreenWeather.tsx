"use client";

import { createContext, useContext } from "react";
import type { WeatherResult } from "@/shared/lib/weather";
import { formatWeatherHeader, formatWeatherTile, weatherFallbackText } from "@/shared/lib/weather";
import { KpiTile } from "./KpiTile";
import { PlaceholderTag } from "./PlaceholderTag";
import { useScreenPoll } from "./use-screen-poll";

// 挂墙大屏的实时天气。顶栏与 KPI 卡共用同一套格式化函数,消除两屏口径漂移(N08)。
//
// RSC 直读 initial + 客户端低频轮询(b-105 计划 D5):
// /screen/overview 是纯 RSC(只有 _overview-occupancy 一个轮询岛),不轮询则挂墙天气
// 会永久冻结在开机那一刻;纯轮询则首屏闪空。二者结合正是 useScreenPoll 的既有设计。
// 间隔取 600 秒:高德实时天气约 1 小时更新,fetchWeather 内 Data Cache 亦为 600 秒,
// 更快只是空转。
const WEATHER_POLL_MS = 600_000;

// ⚠️ 轮询收在 Provider 里,只此一处。
// 若让每个 ScreenWeather 各自 useScreenPoll,同一页的两处(overview 顶栏 + KPI 卡)
// 就各持一份 state:某次 tick 一个成功一个失败,同一块屏上能显示两个不同温度,
// 且要等下一个轮询周期才收敛——正是 N08 要消灭的「同一数据两个口径」,
// 只是从跨屏挪到了屏内。顺带把每轮请求数从 N 降回 1。
const WeatherContext = createContext<WeatherResult | null>(null);

export function ScreenWeatherProvider({
  initial,
  children,
}: {
  initial: WeatherResult;
  children: React.ReactNode;
}) {
  const { data } = useScreenPoll<WeatherResult>("weather", initial, WEATHER_POLL_MS);
  return <WeatherContext.Provider value={data}>{children}</WeatherContext.Provider>;
}

/**
 * 纯渲染,不自持轮询。数据取 Provider;无 Provider 时回落 `initial`(RSC 首屏快照,
 * 不会自行刷新)——这是防御性默认,正常用法是外层套 `ScreenWeatherProvider`。
 */
export function ScreenWeather({
  initial,
  variant = "header",
}: {
  initial: WeatherResult;
  variant?: "header" | "kpi";
}) {
  const data = useContext(WeatherContext) ?? initial;

  if (variant === "kpi") {
    const tile = formatWeatherTile(data);
    return (
      <KpiTile
        title="实时天气"
        value={tile.value}
        unit={tile.unit}
        valueSize={44}
        tone="highlight"
        sub={tile.sub}
      />
    );
  }

  const header = formatWeatherHeader(data);
  if (!header) return <PlaceholderTag text={weatherFallbackText(data)} />;
  return (
    <span className="text-[15px]" style={{ color: "var(--screen-text-dim)" }} aria-live="polite">
      {header}
    </span>
  );
}

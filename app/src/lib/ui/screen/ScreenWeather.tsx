"use client";

import type { WeatherResult } from "@/shared/lib/weather";
import { formatWeatherHeader, formatWeatherTile, weatherFallbackText } from "@/shared/lib/weather";
import { KpiTile } from "./KpiTile";
import { PlaceholderTag } from "./PlaceholderTag";
import { useScreenPoll } from "./use-screen-poll";

// 挂墙大屏的实时天气。顶栏与 KPI 卡共用本组件,消除两屏口径漂移(N08)。
//
// RSC 直读 initial + 客户端低频轮询(b-105 计划 D5):
// /screen/overview 是纯 RSC(只有 _overview-occupancy 一个轮询岛),不轮询则挂墙天气
// 会永久冻结在开机那一刻;纯轮询则首屏闪空。二者结合正是 useScreenPoll 的既有设计。
// 间隔取 600 秒:高德实时天气约 1 小时更新,fetchWeather 内 Data Cache 亦为 600 秒,
// 更快只是空转。
const WEATHER_POLL_MS = 600_000;

export function ScreenWeather({
  initial,
  variant = "header",
}: {
  initial: WeatherResult;
  variant?: "header" | "kpi";
}) {
  const { data } = useScreenPoll<WeatherResult>("weather", initial, WEATHER_POLL_MS);

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
    <span className="text-[15px]" style={{ color: "var(--screen-text-dim)" }}>
      {header}
    </span>
  );
}

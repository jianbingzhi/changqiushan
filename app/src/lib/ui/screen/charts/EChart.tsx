"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import { echarts } from "../echarts-setup";
import { SCREEN_THEME, ensureScreenTheme } from "../echarts-theme";

ensureScreenTheme();

// 所有大屏图表的基座:统一传入按需注册的 echarts 实例 + 大屏主题。
export function EChart({
  option,
  height = "100%",
  className,
  theme,
  onEvents,
}: {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  /** 省略=大屏深色主题;传 null=echarts 默认浅色(供后台浅色卡片复用) */
  theme?: string | object | null;
  /** echarts 事件回调(如 { click: (params) => ... }),供行政图下钻 */
  onEvents?: Record<string, (params: unknown) => void>;
}) {
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      theme={theme === undefined ? SCREEN_THEME : (theme ?? undefined)}
      notMerge
      lazyUpdate
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      className={className}
      onEvents={onEvents}
    />
  );
}

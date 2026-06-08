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
}: {
  option: EChartsOption;
  height?: number | string;
  className?: string;
}) {
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      theme={SCREEN_THEME}
      notMerge
      lazyUpdate
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      className={className}
    />
  );
}

"use client";

import type { EChartsOption } from "echarts";
import { EChart } from "./EChart";

export interface TrendSeries {
  name: string;
  data: number[];
  /** 折线(默认)或柱 */
  type?: "line" | "bar";
  /** 0=左轴(默认) 1=右轴(需 dualAxis) */
  yAxisIndex?: 0 | 1;
  smooth?: boolean;
  /** 折线下填充渐变 */
  area?: boolean;
}

interface Props {
  categories: string[];
  series: TrendSeries[];
  dualAxis?: boolean;
  /** 双轴名称 [左, 右] */
  yNames?: [string, string?];
  height?: number | string;
}

// 多曲线 / 双 Y 轴折线(C2/C3),支持折柱混合。
export function LineTrend({ categories, series, dualAxis, yNames, height }: Props) {
  const yAxis: EChartsOption["yAxis"] = dualAxis
    ? [
        { type: "value", name: yNames?.[0], nameTextStyle: { color: "rgba(232,245,233,0.6)" } },
        { type: "value", name: yNames?.[1], nameTextStyle: { color: "rgba(232,245,233,0.6)" }, splitLine: { show: false } },
      ]
    : { type: "value", name: yNames?.[0], nameTextStyle: { color: "rgba(232,245,233,0.6)" } };

  const option: EChartsOption = {
    grid: { top: 48, right: dualAxis ? 56 : 24, bottom: 32, left: 48 },
    tooltip: { trigger: "axis" },
    legend: { top: 4, icon: "roundRect" },
    xAxis: { type: "category", boundaryGap: series.some((s) => s.type === "bar"), data: categories },
    yAxis,
    series: series.map((s) => ({
      name: s.name,
      type: s.type ?? "line",
      yAxisIndex: s.yAxisIndex ?? 0,
      data: s.data,
      smooth: s.smooth ?? true,
      showSymbol: false,
      lineStyle: s.type === "bar" ? undefined : { width: 2.5 },
      barWidth: s.type === "bar" ? "40%" : undefined,
      areaStyle: s.area ? { opacity: 0.18 } : undefined,
    })),
  };
  return <EChart option={option} height={height} />;
}

"use client";

import type { EChartsOption } from "echarts";
import { EChart } from "./EChart";

interface Props {
  /** matrix[dow][hour],dow 0..6,hour 0..23 */
  matrix: number[][];
  /** 行标签,默认周一→周日 */
  dowLabels?: string[];
  max?: number;
  height?: number | string;
  /** dark=大屏深色(默认);light=后台浅色卡片(绿白阶、深色文字) */
  variant?: "dark" | "light";
  /** tooltip 中的计数名,默认「预约」 */
  metricLabel?: string;
}

const HOURS = Array.from({ length: 24 }, (_, h) => `${h}时`);
const DEFAULT_DOW = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

// 两套配色:深色用于大屏(深→亮绿白),浅色用于后台白卡(白→深绿,避免热点=告警误读)
const PALETTE = {
  dark: {
    range: ["#0A1F0A", "#2D5A27", "#4A8E3F", "#9AD6B0", "#E8F5E9"],
    vmText: "rgba(232,245,233,0.7)",
    axisText: undefined as string | undefined, // 走大屏主题
    cellBorder: "rgba(10,31,10,0.5)",
  },
  light: {
    range: ["#EAF6EC", "#A5D6A7", "#66BB6A", "#388E3C", "#1B5E20"],
    vmText: "#6B7280",
    axisText: "#6B7280",
    cellBorder: "#FFFFFF",
  },
};

// 7×24 热力矩阵(C4 预约/核销分时热力)。
export function Heatmap724({
  matrix,
  dowLabels = DEFAULT_DOW,
  max,
  height,
  variant = "dark",
  metricLabel = "预约",
}: Props) {
  const pal = PALETTE[variant];
  const points: [number, number, number][] = [];
  let computedMax = 0;
  matrix.forEach((row, dow) =>
    row.forEach((v, hour) => {
      points.push([hour, dow, v]);
      if (v > computedMax) computedMax = v;
    }),
  );

  const axisLabelStyle = pal.axisText ? { color: pal.axisText } : undefined;

  const option: EChartsOption = {
    grid: { top: 16, right: 16, bottom: 64, left: 56 },
    tooltip: {
      position: "top",
      formatter: (p) => {
        const d = (p as { data?: [number, number, number] }).data;
        if (!Array.isArray(d)) return "";
        const [hour, dow, count] = d;
        return `${dowLabels[dow] ?? "?"} ${hour}时<br/>${metricLabel} ${count}`;
      },
    },
    xAxis: {
      type: "category",
      data: HOURS,
      splitArea: { show: true },
      axisLabel: { interval: 1, ...axisLabelStyle },
    },
    yAxis: {
      type: "category",
      data: dowLabels,
      splitArea: { show: true },
      axisLabel: axisLabelStyle,
    },
    visualMap: {
      min: 0,
      max: max ?? Math.max(1, computedMax),
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 8,
      textStyle: { color: pal.vmText },
      inRange: { color: pal.range },
    },
    series: [
      {
        type: "heatmap",
        data: points,
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(74,142,63,0.6)" } },
        itemStyle: { borderColor: pal.cellBorder, borderWidth: 1 },
      },
    ],
  };
  return <EChart option={option} height={height} theme={variant === "light" ? null : undefined} />;
}

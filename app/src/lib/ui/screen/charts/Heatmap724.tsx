"use client";

import type { EChartsOption } from "echarts";
import { EChart } from "./EChart";
import { useDarkMode, useMounted } from "@/lib/ui/use-dark-mode";
import { adminChartPalette } from "@/lib/ui/charts/admin-chart-palette";
import { HEATMAP_GRID, HEATMAP_VISUAL_MAP_POS } from "./heatmap-layout";

interface Props {
  /** matrix[dow][hour],dow 0..6,hour 0..23 */
  matrix: number[][];
  /** 行标签,默认周一→周日 */
  dowLabels?: string[];
  max?: number;
  height?: number | string;
  /** dark=大屏深色(默认);light=后台浅色卡片;auto=后台跟随深/浅主题(round-01 N03) */
  variant?: "dark" | "light" | "auto";
  /** tooltip 中的计数名,默认「预约」 */
  metricLabel?: string;
}

const HOURS = Array.from({ length: 24 }, (_, h) => `${h}时`);
const DEFAULT_DOW = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

// 大屏配色(深→亮绿白):大屏恒深色,由注册主题托管文字/轴,故 axisText 留空。
const SCREEN_PALETTE = {
  range: ["#0A1F0A", "#2D5A27", "#4A8E3F", "#9AD6B0", "#E8F5E9"],
  vmText: "rgba(232,245,233,0.7)",
  axisText: undefined as string | undefined,
  cellBorder: "rgba(10,31,10,0.5)",
  splitArea: undefined as [string, string] | undefined,
  tooltipBg: undefined as string | undefined,
  tooltipBorder: undefined as string | undefined,
  tooltipText: undefined as string | undefined,
};

// 后台配色统一收在 charts/admin-chart-palette,双主题共用一张表(round-01 N03)。
function backstagePalette(dark: boolean) {
  const p = adminChartPalette(dark);
  return {
    range: p.heatRange,
    vmText: p.mutedText,
    axisText: p.axisText,
    cellBorder: p.heatCellBorder,
    splitArea: p.splitArea,
    tooltipBg: p.tooltipBg,
    tooltipBorder: p.tooltipBorder,
    tooltipText: p.tooltipText,
  };
}

// 7×24 热力矩阵(C4 预约/核销分时热力)。
export function Heatmap724({
  matrix,
  dowLabels = DEFAULT_DOW,
  max,
  height,
  variant = "dark",
  metricLabel = "预约",
}: Props) {
  // hooks 必须无条件调用;大屏 variant 用不到这两个值,读一次无副作用
  const dark = useDarkMode();
  const mounted = useMounted();
  const pal = variant === "dark" ? SCREEN_PALETTE : backstagePalette(variant === "auto" ? dark : false);
  const points: [number, number, number][] = [];
  let computedMax = 0;
  matrix.forEach((row, dow) =>
    row.forEach((v, hour) => {
      points.push([hour, dow, v]);
      if (v > computedMax) computedMax = v;
    }),
  );

  const axisLabelStyle = pal.axisText ? { color: pal.axisText } : undefined;
  // 交替带:后台双主题下显式给色,不然走 echarts 默认浅灰,深色卡片上是一层白雾
  const splitArea = { show: true, areaStyle: pal.splitArea ? { color: pal.splitArea } : undefined };

  const option: EChartsOption = {
    grid: { ...HEATMAP_GRID },
    tooltip: {
      position: "top",
      backgroundColor: pal.tooltipBg,
      borderColor: pal.tooltipBorder,
      textStyle: pal.tooltipText ? { color: pal.tooltipText } : undefined,
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
      splitArea,
      axisLabel: { interval: 1, ...axisLabelStyle },
    },
    yAxis: {
      type: "category",
      data: dowLabels,
      splitArea,
      axisLabel: axisLabelStyle,
    },
    visualMap: {
      min: 0,
      max: max ?? Math.max(1, computedMax),
      calculable: true,
      // 竖排右侧,避开 X 轴刻度(round-01 N10);位置常量见 heatmap-layout
      ...HEATMAP_VISUAL_MAP_POS,
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
  // 跟随主题的后台变体:挂载前只占位,避免 echarts 先按浅色画一帧再翻深(见 useMounted)
  if (variant === "auto" && !mounted) return <div style={{ height, width: "100%" }} aria-hidden />;

  return <EChart option={option} height={height} theme={variant === "dark" ? undefined : null} />;
}

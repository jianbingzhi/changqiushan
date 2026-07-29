"use client";

import { EChart } from "./EChart";
import { useDarkMode, useMounted } from "@/lib/ui/use-dark-mode";
import { DEFAULT_DOW, SCREEN_HEATMAP_PALETTE, backstageHeatmapPalette, buildHeatmapOption } from "./heatmap-option";

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

// 7×24 热力矩阵(C4 预约/核销分时热力)。
// option 与配色都在 heatmap-option.ts(纯函数,由 heatmap-option.test.ts 真渲染守住);
// 这里只负责选变体 + 主题订阅。
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
  const pal =
    variant === "dark" ? SCREEN_HEATMAP_PALETTE : backstageHeatmapPalette(variant === "auto" ? dark : false);
  const option = buildHeatmapOption({ matrix, dowLabels, max, metricLabel, pal });

  // 跟随主题的后台变体:挂载前只占位,避免 echarts 先按浅色画一帧再翻深(见 useMounted)
  if (variant === "auto" && !mounted) return <div style={{ height, width: "100%" }} aria-hidden />;

  return <EChart option={option} height={height} theme={variant === "dark" ? undefined : null} />;
}

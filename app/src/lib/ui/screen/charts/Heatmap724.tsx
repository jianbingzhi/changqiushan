"use client";

import { useEffect, useRef, useState } from "react";
import { EChart } from "./EChart";
import { useDarkMode, useMounted } from "@/lib/ui/use-dark-mode";
import { DEFAULT_DOW, SCREEN_HEATMAP_PALETTE, backstageHeatmapPalette, buildHeatmapOption } from "./heatmap-option";
import { resolveHourStep } from "./heatmap-layout";

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
  height = "100%",
  variant = "dark",
  metricLabel = "预约",
}: Props) {
  // hooks 必须无条件调用;大屏 variant 用不到这两个值,读一次无副作用
  const dark = useDarkMode();
  const mounted = useMounted();

  // 同一组件的四个调用点宽度差 3 倍(424 ~ 1266px),X 轴刻度疏密要按实测宽度定,
  // 否则最窄的那处(/screen/command)刻度粘连成一片 —— round-01 N20。
  // 宽度只能在客户端量,故先渲染空壳容器、量到宽度再挂 echarts(晚一帧,换刻度一次画对)。
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState<number>();
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // 只在「步长真的跨档」时才 setState:拖窗口时宽度每帧都在变,但刻度疏密几乎不变,
    // 否则每帧都要重建 option 再 notMerge 地重画一次整张图。
    const read = (w: number) =>
      setBoxWidth((prev) =>
        w > 0 && (prev === undefined || resolveHourStep(w) !== resolveHourStep(prev)) ? w : prev,
      );
    const ro = new ResizeObserver((entries) => read(entries[0]?.contentRect.width ?? 0));
    ro.observe(el);
    read(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const pal =
    variant === "dark" ? SCREEN_HEATMAP_PALETTE : backstageHeatmapPalette(variant === "auto" ? dark : false);
  const option = buildHeatmapOption({ matrix, dowLabels, max, metricLabel, pal, width: boxWidth });

  // 跟随主题的后台变体:挂载前只占位,避免 echarts 先按浅色画一帧再翻深(见 useMounted)
  const themePending = variant === "auto" && !mounted;
  const ready = boxWidth !== undefined && !themePending;

  return (
    <div ref={boxRef} style={{ height, width: "100%" }} aria-hidden={ready ? undefined : true}>
      {ready ? <EChart option={option} height="100%" theme={variant === "dark" ? undefined : null} /> : null}
    </div>
  );
}

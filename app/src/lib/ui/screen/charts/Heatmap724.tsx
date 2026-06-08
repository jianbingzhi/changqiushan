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
}

const HOURS = Array.from({ length: 24 }, (_, h) => `${h}时`);
const DEFAULT_DOW = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

// 7×24 热力矩阵(C4 预约/核销分时热力)。
export function Heatmap724({ matrix, dowLabels = DEFAULT_DOW, max, height }: Props) {
  const points: [number, number, number][] = [];
  let computedMax = 0;
  matrix.forEach((row, dow) =>
    row.forEach((v, hour) => {
      points.push([hour, dow, v]);
      if (v > computedMax) computedMax = v;
    }),
  );

  const option: EChartsOption = {
    grid: { top: 16, right: 16, bottom: 64, left: 56 },
    tooltip: {
      position: "top",
      formatter: (p) => {
        const d = (p as unknown as { data: [number, number, number] }).data;
        return `${dowLabels[d[1]]} ${d[0]}时<br/>${d[2]}`;
      },
    },
    xAxis: { type: "category", data: HOURS, splitArea: { show: true }, axisLabel: { interval: 1 } },
    yAxis: { type: "category", data: dowLabels, splitArea: { show: true } },
    visualMap: {
      min: 0,
      max: max ?? Math.max(1, computedMax),
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 8,
      textStyle: { color: "rgba(232,245,233,0.7)" },
      // 绿系连续渐变(深→亮),末色用亮绿白而非警示橙,避免「热点=告警」误读
      inRange: { color: ["#0A1F0A", "#2D5A27", "#4A8E3F", "#9AD6B0", "#E8F5E9"] },
    },
    series: [
      {
        type: "heatmap",
        data: points,
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(74,142,63,0.6)" } },
        itemStyle: { borderColor: "rgba(10,31,10,0.5)", borderWidth: 1 },
      },
    ],
  };
  return <EChart option={option} height={height} />;
}

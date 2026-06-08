"use client";

import type { EChartsOption } from "echarts";
import { EChart } from "./EChart";

interface Props {
  series: { name: string; points: [number, number][] }[];
  xName?: string;
  yName?: string;
  height?: number | string;
}

// 多维分析散点(C7)。
export function ScatterChart({ series, xName, yName, height }: Props) {
  const option: EChartsOption = {
    grid: { top: 44, right: 28, bottom: 44, left: 56 },
    tooltip: { trigger: "item" },
    legend: { top: 4, icon: "circle" },
    xAxis: { type: "value", name: xName, scale: true, nameTextStyle: { color: "rgba(232,245,233,0.6)" } },
    yAxis: { type: "value", name: yName, scale: true, nameTextStyle: { color: "rgba(232,245,233,0.6)" } },
    series: series.map((s) => ({
      name: s.name,
      type: "scatter",
      symbolSize: 12,
      itemStyle: { opacity: 0.8 },
      data: s.points,
    })),
  };
  return <EChart option={option} height={height} />;
}

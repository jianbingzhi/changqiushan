"use client";

import type { EChartsOption } from "echarts";
import { EChart } from "./EChart";

interface Props {
  indicators: { name: string; max: number }[];
  series: { name: string; values: number[] }[];
  height?: number | string;
}

// 多维雷达(C2 爽约多维)。
export function RadarChart({ indicators, series, height }: Props) {
  const option: EChartsOption = {
    tooltip: {},
    legend: { top: 4, icon: "roundRect" },
    radar: {
      indicator: indicators,
      radius: "62%",
      center: ["50%", "56%"],
      axisName: { color: "rgba(232,245,233,0.8)", fontSize: 13 },
    },
    series: [
      {
        type: "radar",
        data: series.map((s) => ({
          name: s.name,
          value: s.values,
          areaStyle: { opacity: 0.18 },
          lineStyle: { width: 2 },
        })),
      },
    ],
  };
  return <EChart option={option} height={height} />;
}

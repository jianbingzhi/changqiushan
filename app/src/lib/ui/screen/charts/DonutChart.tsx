"use client";

import type { EChartsOption } from "echarts";
import { EChart } from "./EChart";

interface Props {
  data: { name: string; value: number }[];
  /** 圆环中心主标(如百分比) */
  centerValue?: string;
  centerLabel?: string;
  height?: number | string;
  showLegend?: boolean;
}

// 环形/饼(C1 性别、C3/C6 占比)。
export function DonutChart({ data, centerValue, centerLabel, height, showLegend = true }: Props) {
  const option: EChartsOption = {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: showLegend ? { bottom: 0, icon: "circle", textStyle: { fontSize: 13 } } : undefined,
    graphic: centerValue
      ? [
          { type: "text", left: "center", top: "40%", style: { text: centerValue, fill: "#FFFFFF", fontSize: 28, fontWeight: "bold" } },
          ...(centerLabel
            ? [{ type: "text" as const, left: "center" as const, top: "54%", style: { text: centerLabel, fill: "rgba(232,245,233,0.6)", fontSize: 13 } }]
            : []),
        ]
      : undefined,
    series: [
      {
        type: "pie",
        radius: ["52%", "72%"],
        center: ["50%", showLegend ? "46%" : "50%"],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: "rgba(10,31,10,0.6)", borderWidth: 2 },
        data,
      },
    ],
  };
  return <EChart option={option} height={height} />;
}

"use client";

import type { EChartsOption } from "echarts";
import { EChart } from "./EChart";

interface Props {
  data: { name: string; value: number }[];
  height?: number | string;
}

// 转化漏斗(C2 预约→入园→履约/爽约)。
export function FunnelChart({ data, height }: Props) {
  const option: EChartsOption = {
    tooltip: { trigger: "item", formatter: "{b}: {c}" },
    legend: { top: 4, icon: "roundRect" },
    series: [
      {
        type: "funnel",
        top: 44,
        bottom: 12,
        left: "8%",
        width: "84%",
        minSize: "24%",
        gap: 3,
        label: { show: true, position: "inside", color: "#FFFFFF", fontSize: 14, formatter: "{b} {c}" },
        labelLine: { show: false },
        itemStyle: { borderColor: "rgba(10,31,10,0.6)", borderWidth: 1 },
        data,
      },
    ],
  };
  return <EChart option={option} height={height} />;
}

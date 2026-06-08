"use client";

import type { EChartsOption } from "echarts";
import { EChart } from "./EChart";

interface Props {
  /** 0..100 百分比 */
  value: number;
  label?: string;
  /** 进度颜色(默认随阈值:<80 绿 / 80-90 橙 / >=90 红) */
  color?: string;
  height?: number | string;
}

function thresholdColor(v: number): string {
  if (v >= 90) return "#DC2626";
  if (v >= 80) return "#D97706";
  return "#4A8E3F";
}

// 仪表环(C6 承载率/在线率)。
export function GaugeRing({ value, label, color, height }: Props) {
  const c = color ?? thresholdColor(value);
  const option: EChartsOption = {
    series: [
      {
        type: "gauge",
        startAngle: 220,
        endAngle: -40,
        min: 0,
        max: 100,
        radius: "92%",
        progress: { show: true, width: 14, itemStyle: { color: c } },
        axisLine: { lineStyle: { width: 14, color: [[1, "rgba(232,245,233,0.12)"]] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: { offsetCenter: [0, "32%"], color: "rgba(232,245,233,0.7)", fontSize: 14 },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, "-6%"],
          formatter: "{value}%",
          color: c,
          fontSize: 34,
          fontWeight: "bolder",
        },
        data: [{ value: Math.round(value), name: label ?? "" }],
      },
    ],
  };
  return <EChart option={option} height={height} />;
}

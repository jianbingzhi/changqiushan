"use client";

import type { EChartsOption } from "echarts";
import { EChart } from "./EChart";

interface Props {
  categories: string[];
  series: { name: string; data: number[] }[];
  horizontal?: boolean;
  /** 百分比堆叠(各列归一到 100%) */
  percent?: boolean;
  height?: number | string;
}

// 堆叠条(C1 渠道占比、C3 时段堆叠)。
export function StackedBar({ categories, series, horizontal, percent, height }: Props) {
  const cat: EChartsOption["xAxis"] = { type: "category", data: categories };
  const val: EChartsOption["yAxis"] = {
    type: "value",
    max: percent ? 100 : undefined,
    axisLabel: percent ? { formatter: "{value}%" } : undefined,
  };

  const option: EChartsOption = {
    grid: { top: 36, right: 20, bottom: 28, left: horizontal ? 80 : 48 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { top: 4, icon: "roundRect" },
    xAxis: horizontal ? (val as EChartsOption["xAxis"]) : cat,
    yAxis: horizontal ? (cat as EChartsOption["yAxis"]) : val,
    series: series.map((s) => ({
      name: s.name,
      type: "bar",
      stack: "total",
      barWidth: "46%",
      emphasis: { focus: "series" },
      data: s.data,
    })),
  };
  return <EChart option={option} height={height} />;
}

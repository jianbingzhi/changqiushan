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
// percent=true:按列归一到 100%(各类目下各 series 之和=100),并配 % 轴 + tooltip。
export function StackedBar({ categories, series, horizontal, percent, height }: Props) {
  // 列总计:第 i 类目下所有 series 值之和,用于百分比归一
  const colTotals = categories.map((_, i) => series.reduce((s, ser) => s + (ser.data[i] ?? 0), 0));
  const renderSeries = percent
    ? series.map((s) => ({
        ...s,
        data: s.data.map((v, i) => (colTotals[i] > 0 ? Math.round((v / colTotals[i]) * 1000) / 10 : 0)),
      }))
    : series;

  const cat: EChartsOption["xAxis"] = { type: "category", data: categories };
  const val: EChartsOption["yAxis"] = {
    type: "value",
    max: percent ? 100 : undefined,
    axisLabel: percent ? { formatter: "{value}%" } : undefined,
  };

  const option: EChartsOption = {
    grid: { top: 36, right: 20, bottom: 28, left: horizontal ? 80 : 48 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: percent ? (v) => `${v}%` : undefined },
    legend: { top: 4, icon: "roundRect" },
    xAxis: horizontal ? (val as EChartsOption["xAxis"]) : cat,
    yAxis: horizontal ? (cat as EChartsOption["yAxis"]) : val,
    series: renderSeries.map((s) => ({
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

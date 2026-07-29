// 7×24 热力矩阵的 echarts option 构造 + 两套配色。
//
// 为什么从 Heatmap724.tsx 抽出来:组件是 "use client" + hooks,单测只能在 jsdom/React 里跑,
// 结果 round-01 N13 那个「大屏三块全空白」的缺陷单测一条都没盖到——旧的 heatmap-layout.test.ts
// 是自己手搓一份 option 去渲染的,和组件真正下发的 option 是两份东西,组件里写错了它照样绿。
// 现在 option 只有这一处产地,守卫(heatmap-option.test.ts)渲染的就是线上那一份。
//
// ⚠️ 改这个文件前先读 buildHeatmapOption 里 splitArea / axisLabel 那两段注释:round-01 的 N13
//    (整块空白 + 抛异常)与 N15(大屏丢了周一…周日七行标签)是同一条根因的两次发作——
//    **把某个键显式下发成 undefined,等于把注册主题配好的值覆盖成空**,而不是"什么都没做"。

import type { EChartsOption } from "echarts";
import { adminChartPalette } from "@/lib/ui/charts/admin-chart-palette";
import { SCREEN_SPLIT_AREA } from "../echarts-theme";
import { HEATMAP_GRID, HEATMAP_VISUAL_MAP_POS, resolveHourStep } from "./heatmap-layout";

export interface HeatmapPalette {
  /** 色阶(低→高) */
  range: string[];
  /** 色阶条标注文字 */
  vmText: string;
  /** 轴刻度文字;留空=交给注册主题(大屏) */
  axisText?: string;
  /** 热力格描边 */
  cellBorder: string;
  /**
   * 坐标轴交替带配色。
   *
   * ⚠️ 必填,且必须是非空数组——这是 round-01 N13(大屏三块热力矩阵整片空白 + 抛
   * TypeError: Cannot read properties of null (reading 'length'))的根因所在:
   * 旧代码大屏变体给的是 undefined,下发出去就是 `splitArea.areaStyle = undefined`,
   * echarts 的 option merge 会用它**覆盖掉**默认主题里的 areaStyle,
   * 到 rectCoordAxisBuildSplitArea 读 color.length 时炸开 → 整个 axis view 渲染中断、
   * 一格都画不出来(后台变体给的是真数组,所以只崩大屏、后台看着好好的)。
   * 所以这里不给可选,让「忘了配色」在编译期就过不去;运行期由 buildHeatmapOption 再兜一道。
   */
  splitArea: [string, string];
  tooltipBg?: string;
  tooltipBorder?: string;
  tooltipText?: string;
}

// 大屏配色(深→亮绿白):大屏恒深色,轴文字与 tooltip 由注册主题(screen/echarts-theme)托管,
// 故 axisText / tooltip* 一概不给,留空即交回主题。
export const SCREEN_HEATMAP_PALETTE: HeatmapPalette = {
  range: ["#0A1F0A", "#2D5A27", "#4A8E3F", "#9AD6B0", "#E8F5E9"],
  vmText: "rgba(232,245,233,0.7)",
  cellBorder: "rgba(10,31,10,0.5)",
  // 与雷达图共用注册主题里那一份大屏交替带色值(单一来源,两处各写一份必漂);
  // ⚠️ 唯独这项不能留空,理由见类型注释
  splitArea: SCREEN_SPLIT_AREA,
};

// 后台配色统一收在 charts/admin-chart-palette,双主题共用一张表(round-01 N03)。
export function backstageHeatmapPalette(dark: boolean): HeatmapPalette {
  const p = adminChartPalette(dark);
  return {
    range: p.heatRange,
    vmText: p.mutedText,
    axisText: p.axisText,
    cellBorder: p.heatCellBorder,
    splitArea: p.splitArea,
    tooltipBg: p.tooltipBg,
    tooltipBorder: p.tooltipBorder,
    tooltipText: p.tooltipText,
  };
}

const HOURS = Array.from({ length: 24 }, (_, h) => `${h}时`);
export const DEFAULT_DOW = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export interface HeatmapOptionInput {
  /** matrix[dow][hour],dow 0..6,hour 0..23 */
  matrix: number[][];
  dowLabels?: string[];
  max?: number;
  metricLabel?: string;
  pal: HeatmapPalette;
  /**
   * 图表容器的实测宽度(px),决定 X 轴刻度疏密(round-01 N20)。
   * 省略 = 宽度未知(SSR / 尚未测量),按最密的每 2 小时一个,即四处调用点的原有疏密。
   */
  width?: number;
}

export function buildHeatmapOption({
  matrix,
  dowLabels = DEFAULT_DOW,
  max,
  metricLabel = "预约",
  pal,
  width,
}: HeatmapOptionInput): EChartsOption {
  const points: [number, number, number][] = [];
  let computedMax = 0;
  matrix.forEach((row, dow) =>
    row.forEach((v, hour) => {
      points.push([hour, dow, v]);
      if (v > computedMax) computedMax = v;
    }),
  );

  // 轴刻度文字:大屏留空(交给注册主题),此时只下发 `{}` —— 与 splitArea 同一条铁律,
  // 绝不能下发 `axisLabel: undefined`,那是把主题配好的 axisLabel 整个覆盖成空。
  // round-01 N15 就是这么丢的:xAxis 写的是 `{ interval: 1, ...axisLabelStyle }`(展开后仍是对象,
  // 所以 X 轴刻度好好的),yAxis 写的是裸 `axisLabelStyle`,大屏下 = undefined → 周一…周日七行标签全没了。
  // 每条轴各要一份新对象(理由同 splitArea:echarts 就地 merge,共用引用等于两轴互相污染)。
  const axisLabelColor = pal.axisText ? { color: pal.axisText } : {};
  // 交替带:两套变体都显式给色(缺省走 echarts 默认浅灰,深底上是一层白雾)。
  // 兜底 —— 万一色值为空,整个 areaStyle 键都不下发,让主题/默认值生效;
  // 绝不能下发 `areaStyle: undefined`,那会把默认值覆盖成空并让 echarts 崩(N13)。
  // xAxis / yAxis 各要一份新对象:echarts 会就地 merge,共用同一个引用等于两轴互相污染。
  const splitArea = () =>
    pal.splitArea?.length ? { show: true, areaStyle: { color: [...pal.splitArea] } } : { show: true };

  return {
    grid: { ...HEATMAP_GRID },
    tooltip: {
      position: "top",
      backgroundColor: pal.tooltipBg,
      borderColor: pal.tooltipBorder,
      textStyle: pal.tooltipText ? { color: pal.tooltipText } : undefined,
      formatter: (p) => {
        const d = (p as { data?: [number, number, number] }).data;
        if (!Array.isArray(d)) return "";
        const [hour, dow, count] = d;
        return `${dowLabels[dow] ?? "?"} ${hour}时<br/>${metricLabel} ${count}`;
      },
    },
    xAxis: {
      type: "category",
      data: HOURS,
      splitArea: splitArea(),
      // interval 是「隔几个画一个」,故 = 步长 - 1(步长 2 小时 ⇒ interval 1,与原状一致)。
      // 步长按容器宽自适应,见 heatmap-layout.resolveHourStep(round-01 N20)。
      axisLabel: { interval: resolveHourStep(width) - 1, ...axisLabelColor },
    },
    yAxis: {
      type: "category",
      data: dowLabels,
      splitArea: splitArea(),
      axisLabel: { ...axisLabelColor },
    },
    visualMap: {
      min: 0,
      max: max ?? Math.max(1, computedMax),
      calculable: true,
      // 竖排右侧,避开 X 轴刻度(round-01 N10);位置常量见 heatmap-layout
      ...HEATMAP_VISUAL_MAP_POS,
      textStyle: { color: pal.vmText },
      inRange: { color: pal.range },
    },
    series: [
      {
        type: "heatmap",
        data: points,
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(74,142,63,0.6)" } },
        itemStyle: { borderColor: pal.cellBorder, borderWidth: 1 },
      },
    ],
  };
}

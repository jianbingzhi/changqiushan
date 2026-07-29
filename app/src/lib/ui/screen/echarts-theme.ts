// 大屏专用 echarts 主题:集中注入色板 + 暗色文字/轴/tooltip + 透明底。
// 各图表组件只描述数据,配色统一由此主题托管,改色一处生效。
import { echarts } from "./echarts-setup";

export const SCREEN_THEME = "changqiushan-screen";

// 色板:辉光绿 → 数据蓝 → 警示橙 → 品牌绿 → 浅绿白 → 失败红
export const SCREEN_PALETTE = ["#4A8E3F", "#4FB3E0", "#D97706", "#2D5A27", "#9AD6B0", "#DC2626"];

const TEXT = "#E8F5E9";
const TEXT_DIM = "rgba(232,245,233,0.6)";
const AXIS_LINE = "rgba(232,245,233,0.25)";
const SPLIT_LINE = "rgba(232,245,233,0.08)";
const FONT =
  'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

/**
 * 大屏交替带配色(雷达 splitArea / 热力矩阵 x-y 轴 splitArea 共用)。
 * 单一来源:两处各写一份必漂(round-01 N13 复审建议 ①)。
 */
export const SCREEN_SPLIT_AREA: [string, string] = ["rgba(74,142,63,0.04)", "rgba(74,142,63,0.08)"];

const axis = {
  axisLine: { lineStyle: { color: AXIS_LINE } },
  axisTick: { lineStyle: { color: AXIS_LINE } },
  axisLabel: { color: TEXT_DIM, fontSize: 14 },
  splitLine: { lineStyle: { color: SPLIT_LINE } },
};

let registered = false;

export function ensureScreenTheme() {
  if (registered) return;
  echarts.registerTheme(SCREEN_THEME, {
    color: SCREEN_PALETTE,
    backgroundColor: "transparent",
    textStyle: { color: TEXT, fontFamily: FONT },
    title: { textStyle: { color: "#FFFFFF" }, subtextStyle: { color: TEXT_DIM } },
    legend: { textStyle: { color: TEXT, fontSize: 14 }, inactiveColor: "rgba(232,245,233,0.25)" },
    tooltip: {
      backgroundColor: "rgba(8,24,8,0.94)",
      borderColor: "rgba(74,142,63,0.5)",
      borderWidth: 1,
      textStyle: { color: TEXT, fontSize: 14 },
      axisPointer: { lineStyle: { color: "rgba(74,142,63,0.5)" }, crossStyle: { color: "rgba(74,142,63,0.5)" } },
    },
    categoryAxis: axis,
    valueAxis: axis,
    logAxis: axis,
    timeAxis: axis,
    radar: {
      name: { textStyle: { color: TEXT } },
      axisLine: { lineStyle: { color: AXIS_LINE } },
      splitLine: { lineStyle: { color: SPLIT_LINE } },
      splitArea: { areaStyle: { color: [...SCREEN_SPLIT_AREA] } },
    },
  });
  registered = true;
}

// 后台(非大屏)echarts 图表的双主题取色。
//
// 为什么要有这张表:大屏图表有注册好的深色主题(`lib/ui/screen/echarts-theme.ts`),
// 而后台图表嵌在会切主题的白/深卡片里,只能走 echarts 默认主题(`theme={null}`)——
// echarts 主题是**实例化时**绑定的,切主题不会重绑;所以后台图表的颜色必须由 option 显式给,
// 主题一变 option 就变,setOption 即重绘。round-01 N03/N05 就是漏了这一步:
// 深色下热力矩阵与行政图仍是浅色底(且刷新也不恢复,因为浅色是写死在 option 里的)。
//
// 值与 `app/src/app/globals.css` 的 token 实值对齐(--card / --muted / --border /
// --text-secondary / --text-muted / --warning),改主题 token 时这里同步改。

export interface AdminChartPalette {
  /** 坐标轴刻度文字 = --text-secondary */
  axisText: string;
  /** 次要说明文字(visualMap 标注等)= --text-muted 提亮一档,保证小字可读 */
  mutedText: string;
  /** 坐标轴交替带(echarts 默认是写死的浅灰,深色下会糊成一层白雾) */
  splitArea: [string, string];
  /** 热力矩阵色阶:低值贴近卡片底色(空即"无"),高值最亮 */
  heatRange: string[];
  /** 热力格描边:取卡片底色,用底色勾缝 */
  heatCellBorder: string;
  /** 行政图无数据地块 = --muted */
  mapArea: string;
  /** 行政图地块描边:浅色沿用白缝(白卡上以底色勾边),深色用 --border */
  mapBorder: string;
  /** 行政图数值色阶 */
  mapRange: string[];
  /** 行政图 hover 高亮 = --warning */
  mapEmphasis: string;
  /** tooltip 浮层:底 = --popover,边 = --border,字 = --fg */
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

const LIGHT: AdminChartPalette = {
  axisText: "#6B7280",
  mutedText: "#6B7280",
  splitArea: ["rgba(0,0,0,0)", "rgba(0,0,0,0.02)"],
  heatRange: ["#EAF6EC", "#A5D6A7", "#66BB6A", "#388E3C", "#1B5E20"],
  heatCellBorder: "#FFFFFF",
  mapArea: "#F3F4F6",
  mapBorder: "#FFFFFF",
  mapRange: ["#EAF6EC", "#A5D6A7", "#66BB6A", "#388E3C", "#1B5E20"],
  mapEmphasis: "#FFD54F",
  tooltipBg: "#FFFFFF",
  tooltipBorder: "#E5E7EB",
  tooltipText: "#1F2937",
};

const DARK: AdminChartPalette = {
  axisText: "#A8B5AC",
  mutedText: "#A8B5AC",
  splitArea: ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.05)"],
  // 低值贴 --muted(#1A241E),高值走品牌绿到浅绿白,与大屏色阶同族但压低亮度以配后台卡片
  heatRange: ["#1A241E", "#2D5A27", "#4A8E3F", "#7CC47F", "#B7E4B9"],
  heatCellBorder: "#16201A",
  mapArea: "#1A241E",
  mapBorder: "#2A3A30",
  mapRange: ["#1E3A22", "#2D5A27", "#4A8E3F", "#7CC47F", "#B7E4B9"],
  mapEmphasis: "#F59E0B",
  tooltipBg: "#16201A",
  tooltipBorder: "#2A3A30",
  tooltipText: "#E8EFE3",
};

/** 按当前主题取后台图表配色。 */
export function adminChartPalette(dark: boolean): AdminChartPalette {
  return dark ? DARK : LIGHT;
}

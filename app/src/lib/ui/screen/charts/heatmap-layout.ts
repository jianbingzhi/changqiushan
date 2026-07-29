// 7×24 热力图的布局(绘图区留白 + 色阶条位置),与配色无关,故单独收在这里。
//
// round-01 N10:色阶条原先横排在绘图区正下方(grid.bottom 64 + visualMap bottom 8),
// 两端的端点标签与 X 轴时间刻度落在同一条水平带上,把「10时」「12时」压住;
// 深浅两主题都复现——纯几何问题。改为竖排在右侧留白里,两者彻底分处不同区域。
// 由 heatmap-layout.test.ts 用 echarts SSR 实测坐标守住,不靠肉眼。

export const HEATMAP_GRID = { top: 16, right: 64, bottom: 32, left: 56 } as const;

export const HEATMAP_VISUAL_MAP_POS = {
  orient: "vertical",
  right: 12,
  top: "middle",
} as const;

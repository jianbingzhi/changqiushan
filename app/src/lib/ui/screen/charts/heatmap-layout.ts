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

// ── X 轴时间刻度的疏密(round-01 N20)────────────────────────────────────────
//
// 同一个组件被四处复用,画布宽度差 3 倍:/screen/heatmap 1266px、/analytics/heatmap 1150px、
// /screen/poster 760px,而 /screen/command 的热力块被 60fr/40fr 分栏压到 **424px**。
// 原来 X 轴写死 `interval: 1`(每 2 小时一个、共 12 个标签),宽的三处间距充裕,
// 424px 那处每格只有 12.7px、而「22时」在大屏 14px 字号下占 ~30px ⇒ 8时 往后连成一片。
//
// 修法:按实测容器宽算出一个**均匀**步长,而不是交给 echarts 的 `interval: "auto"`——
// auto 在宽画布上会把 12 个标签变成 24 个(整屏版/后台版现在是正常的,不该被这条修复改动)。
// 步长只取 24 的因数,刻度才落在整点钟上;下限锁 2,保证宽画布仍是现状的每 2 小时一个。

/** 「22时」在大屏 14px 字号下的占宽上限(后台 12px 更窄,取大的那头才不会估漏) */
const HOUR_LABEL_WIDTH = 30;
/** 相邻两个刻度之间至少留的空白 */
const HOUR_LABEL_GAP = 8;
/** 只取 24 的因数:2/3/4/6/8/12 小时一个,刻度才落在整齐的钟点上 */
const HOUR_STEPS = [2, 3, 4, 6, 8, 12] as const;

/**
 * 按图表容器宽度定 X 轴「几小时打一个刻度」。
 * 宽度未知(SSR / 尚未测量)时回落到 2 —— 即四处调用点原本的疏密,不因自适应变密。
 */
export function resolveHourStep(chartWidth?: number): number {
  if (!chartWidth || !Number.isFinite(chartWidth)) return HOUR_STEPS[0];
  const slot = (chartWidth - HEATMAP_GRID.left - HEATMAP_GRID.right) / 24;
  if (slot <= 0) return HOUR_STEPS[HOUR_STEPS.length - 1];
  const need = (HOUR_LABEL_WIDTH + HOUR_LABEL_GAP) / slot;
  return HOUR_STEPS.find((s) => s >= need) ?? HOUR_STEPS[HOUR_STEPS.length - 1];
}

// 整页地图 fitView 的浮层避让计算(round-01 N12)。
//
// 缺陷:/traffic/parking 的 4 个标点确实都上了图,但默认视野下 2 个被页面自家的浮层卡压住
// (西门停车场压在左上「停车场动静态上图」KPI 卡下,东门生态停车场压在右侧数据面板下),
// 1324×804 / 1440×900 两档分辨率都复现,1920 以上才全露 —— 地图把标点铺满整个容器,
// 而容器的四角本来就被浮层占着。
//
// 修法:setFitView 的第三参 avoid([上, 下, 左, 右] 像素内缩)按浮层实际占位算出来,
// 而不是写死一组常数 —— 浮层高度随内容(KPI 换行、图例条数、面板收起)变,写死必漂。
//
// 几何在这里做成纯函数,由 fit-view-avoid.test.ts 用真实布局尺寸守住;
// 取 DOM 矩形的那半截在 AmapContainer 里。

export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** 浮层与最近标点之间额外留的呼吸位(px) */
const FIT_VIEW_GAP = 12;

/** 单边内缩上限:占该方向的比例。浮层大到挡住整屏时(极窄视口)保底留出可视区,不把视野压成 0。 */
const MAX_INSET_RATIO = 0.4;

/**
 * 按浮层占位算 setFitView 的 avoid 内缩 `[上, 下, 左, 右]`。
 *
 * 每个浮层只往**离它最近的那条边**算内缩:左上角那张 360×101 的 KPI 卡,从上边让开 117px
 * 就够了,从左边让要让 376px —— 同样避开却白丢三倍视野。全无浮层时返回 undefined,
 * 交回高德默认避让,不改变其它页面的取景。
 */
export function fitViewAvoid(base: Rect, overlays: Rect[]): [number, number, number, number] | undefined {
  const width = base.right - base.left;
  const height = base.bottom - base.top;
  if (width <= 0 || height <= 0) return undefined;

  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;
  let hit = false;

  for (const r of overlays) {
    // 收起的面板/未渲染的卡片没有尺寸,不参与计算
    if (r.right <= r.left || r.bottom <= r.top) continue;
    // 完全落在地图外的浮层(如面板被挪到地图旁边)不用避让
    if (r.right <= base.left || r.left >= base.right || r.bottom <= base.top || r.top >= base.bottom) continue;
    hit = true;

    const fromTop = r.bottom - base.top;
    const fromBottom = base.bottom - r.top;
    const fromLeft = r.right - base.left;
    const fromRight = base.right - r.left;
    const cheapest = Math.min(fromTop, fromBottom, fromLeft, fromRight);

    if (cheapest === fromTop) top = Math.max(top, fromTop);
    else if (cheapest === fromBottom) bottom = Math.max(bottom, fromBottom);
    else if (cheapest === fromLeft) left = Math.max(left, fromLeft);
    else right = Math.max(right, fromRight);
  }
  if (!hit) return undefined;

  const cap = (v: number, extent: number) => Math.round(Math.min(v + FIT_VIEW_GAP, extent * MAX_INSET_RATIO));
  return [cap(top, height), cap(bottom, height), cap(left, width), cap(right, width)];
}

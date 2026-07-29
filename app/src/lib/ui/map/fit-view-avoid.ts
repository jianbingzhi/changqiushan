// 整页地图 fitView 的避让计算(round-01 N12)。
//
// 缺陷:/traffic/parking 的 4 个标点确实都上了图,但默认视野下有 2 个看不到——
// 一轮修的是「被页面自家浮层卡压住」(西门压在左上 KPI 卡下,东门压在右侧数据面板下);
// r13 复验发现 ≥1440 已修好,但 **1324×804 仍复现**,而且这次西门是被**左侧导航栏**挡住的——
// 侧边栏在地图容器**之外**,说明问题不再是"被浮层盖住",而是**标签向左溢出了地图可视区边缘**。
//
// 根因:上一轮只把「标点」当成一个点来避让,可标点旁边挂着 100~150px 宽的文字标签
// (label direction=top,以标点为中心向上展开、向左右各溢出半个标签宽)。
// 标点自己落在安全区边缘 = 它的标签已经出界(或探进右侧面板)。1920 以上只是余量恰好够,不是修好了。
//
// 修法:安全区在浮层内缩之上,再叠一层「标签自身的占位」——
//   左/右各让半个标签宽、上边让一个标签高,标点才真的连标签一起落在可视区内。
// 标签尺寸优先**就地量 DOM**(AmapContainer 里那半截),量不到才按文字估一版(estimateLabelExtent),
// 估算刻意取偏大值:估大了只是少一点视野,估小了就是 N12 原样复发。
//
// 几何在这里做成纯函数,由 fit-view-avoid.test.ts 用真实布局尺寸守住。

export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * 标点的实际视觉占位(相对标点本身,单位 px)。
 * 没有标签的调用点(大屏各图、路况页)传 undefined,行为与本次改动前完全一致。
 */
export interface MarkerExtent {
  /** 标签相对标点向左右各溢出的宽度 */
  side: number;
  /** 标签相对标点向上溢出的高度 */
  above: number;
  /** 标点圆点自身向下占的高度 */
  below: number;
}

/** 浮层/边缘与最近标点之间额外留的呼吸位(px) */
const FIT_VIEW_GAP = 12;

/** 取景区至少要保住的比例:浮层 + 标签大到吃满整屏时(极窄视口)保底留出可视区,不把视野压成 0 */
const MIN_VIEW_RATIO = 0.3;

// —— 标签尺寸估算的口径(仅在 DOM 量不到时兜底;实测标签为 12px 字、101~150×27) ——
const LABEL_FONT_PX = 12;
/** 西文/数字按 0.6 个字宽估 */
const LABEL_LATIN_RATIO = 0.6;
/** 左右 padding + 边框(与 globals.css 里 .amap-marker-label 的 padding: 2px 8px 对齐,取偏大值) */
const LABEL_PADDING_X = 20;
/** 单行标签高度 + setLabel 的 -6px 偏移 */
const LABEL_ABOVE = 27 + 6;
/** 14px 圆点(anchor=center)向下占的一半 + 描边 */
const MARKER_DOT_BELOW = 9;

/** CJK/全角按一个字宽算,其余按 0.6 —— 判据是码位,不是正则,免得漏掉标点与全角符号 */
function isWide(codePoint: number): boolean {
  return codePoint >= 0x2e80;
}

/**
 * 按标签文字估算标点占位。DOM 量得到时不走这里;量不到(首帧标签还没排版、jsdom)才用它兜底。
 * 刻意估偏大:多让一点视野无伤,少让一点就是 N12 复发。
 */
export function estimateLabelExtent(labels: string[]): MarkerExtent {
  if (labels.length === 0) return { side: 0, above: 0, below: 0 };
  let widest = 0;
  for (const text of labels) {
    let width = LABEL_PADDING_X;
    for (const ch of text) {
      width += isWide(ch.codePointAt(0) ?? 0) ? LABEL_FONT_PX : LABEL_FONT_PX * LABEL_LATIN_RATIO;
    }
    widest = Math.max(widest, width);
  }
  return { side: widest / 2, above: LABEL_ABOVE, below: MARKER_DOT_BELOW };
}

const NO_EXTENT: MarkerExtent = { side: 0, above: 0, below: 0 };

/**
 * 按浮层占位 + 标点自身占位,算 setFitView 的 avoid 内缩 `[上, 下, 左, 右]`。
 *
 * 浮层部分:每个浮层只往**离它最近的那条边**算内缩——左上角那张 360×101 的 KPI 卡,从上边让开
 * 117px 就够了,从左边让要让 376px,同样避开却白丢三倍视野。
 * 标点部分:四边再各叠一份标签占位(N12 r13——标点在安全区边缘时,标签仍会溢出容器或探进面板)。
 *
 * 两者都没有(无浮层且无标签)时返回 undefined,交回高德默认避让,不改变其它页面的取景。
 */
/** 四边内缩量(未加呼吸位、未叠标签占位);hit=是否真有浮层压在地图上 */
interface OverlayInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
  hit: boolean;
}

/**
 * 浮层部分的内缩:每个浮层只往**离它最近的那条边**算——左上角那张 360×101 的 KPI 卡,从上边让开
 * 117px 就够了,从左边让要让 376px,同样避开却白丢三倍视野。
 * fitViewAvoid(算 setFitView 的 avoid)与 overlaySafeArea(算实测校正的安全区)共用这一份几何,
 * 免得两处对"浮层占了哪儿"给出不同答案。
 */
function overlayInsets(base: Rect, overlays: Rect[]): OverlayInsets {
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

  return { top, bottom, left, right, hit };
}

/** 容器内的矩形(以容器左上角为原点) */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * 浮层让开之后、地图容器里还剩下的可视安全区(容器局部坐标,已含呼吸位)。
 * 与 fitViewAvoid 的区别:**不叠标签占位**——标签占多大由 AmapContainer 就地量真实 DOM 得到,
 * 交给 planFitCorrection 处理(round-01 N12 r19:估出来的占位对不对,只有量了才知道)。
 * 单边最多让到该轴的 (1 - MIN_VIEW_RATIO),两边之和同样受这条上限约束。
 */
export function overlaySafeArea(base: Rect, overlays: Rect[]): Box {
  const width = base.right - base.left;
  const height = base.bottom - base.top;
  const { top, bottom, left, right } = overlayInsets(base, overlays);
  const [t, b] = clampAxis(top, bottom, height);
  const [l, r] = clampAxis(left, right, width);
  return { left: l, top: t, right: width - r, bottom: height - b };
}

/** 两边内缩各加呼吸位,总量超过该轴可让上限时按比例同收(而不是各自砍到上限——那会改掉两边的比例关系) */
function clampAxis(a: number, b: number, size: number): [number, number] {
  const room = size * (1 - MIN_VIEW_RATIO);
  const [ga, gb] = [a + FIT_VIEW_GAP, b + FIT_VIEW_GAP];
  const total = ga + gb;
  const scale = total > room ? room / total : 1;
  return [Math.round(ga * scale), Math.round(gb * scale)];
}

export function fitViewAvoid(
  base: Rect,
  overlays: Rect[],
  extent: MarkerExtent = NO_EXTENT,
): [number, number, number, number] | undefined {
  const width = base.right - base.left;
  const height = base.bottom - base.top;
  if (width <= 0 || height <= 0) return undefined;

  const insets = overlayInsets(base, overlays);

  const hasExtent = extent.side > 0 || extent.above > 0 || extent.below > 0;
  if (!insets.hit && !hasExtent) return undefined;

  // 标签占位与浮层内缩是**叠加**关系:标点要先躲开浮层,它的标签还要再往外多占半个标签宽。
  const [t, b] = clampAxis(insets.top + extent.above, insets.bottom + extent.below, height);
  const [l, r] = clampAxis(insets.left + extent.side, insets.right + extent.side, width);
  return [t, b, l, r];
}

// 取景的**实测校正**(round-01 N12 第三轮)。
//
// 前两轮都是「算准 avoid,交给高德 setFitView 去摆」:r10 算浮层、r15 再叠一层标签占位,
// 几何两次都被评审独立核过,可真机两次都还是 1324×804 / 1440×900 下 2/4 被遮挡
// (r17 实测:西门那张标签的 rect.x=174,而地图容器 x=240 —— 标签左缘直接落到容器外面去了)。
//
// 两轮下来结论很清楚:**「算出来的 avoid」和「屏幕上标点最后落在哪」之间是有落差的**——
// 落差可能来自 setFitView 对 avoid 的解释、缩放级别的取整、也可能来自视口变化后那一次取景根本没重算。
// 与其继续猜是哪一种,不如**换一种确定的做法:摆完之后去量,量到越界就自己收回来**。
//
// 这个模块只做那一步纯几何:
//   输入 = 标点点位包围盒(spread,随缩放伸缩)、连标签在内的实际绘制包围盒(painted,量 DOM 得来)、
//          浮层让开后的安全区(safe)、缩放中心(容器中心);
//   输出 = 还需要施加的缩放倍率 + 平移量。
// 调用方(AmapContainer)每帧重新量一次再要一次计划,所以预测误差不会累积——
// 量到的就是屏幕上真实的样子,这正是前两轮缺的那一环。

import type { Box } from "./fit-view-avoid";

export type { Box };

export interface FitCorrection {
  /** 需要施加的缩放倍率(≤1,只往外缩不往里推——把标点推近只会制造新的越界) */
  scale: number;
  /** 缩放之后还需要把画面内容平移多少(容器坐标,右/下为正) */
  dx: number;
  dy: number;
}

/** 缩放下限:再怎么让也不把地图缩到 3 个层级之外(那样整幅图会小得没法看,不如让用户自己拖) */
const MIN_SCALE = 1 / 8;
/** 小于这个量的缩放/平移当作已到位,免得浮点误差让校正来回抖 */
const SCALE_EPSILON = 0.005;
const SHIFT_EPSILON = 1;
/**
 * 缩放时多留 1px:正好贴着安全区边缘算出来的倍率,配上后面平移量的取整,会差出零点几个像素——
 * 判据是「整个框在安全区内」,差 0.1px 也是在外面。留一格就永远不会卡在这条线上。
 */
const FIT_SLACK = 1;

const NO_CORRECTION: FitCorrection = { scale: 1, dx: 0, dy: 0 };

/** 取整永远朝着「多让一点」的方向,少让一像素就还是越界 */
const outward = (v: number) => (v > 0 ? Math.ceil(v) : Math.floor(v));

const width = (b: Box) => b.right - b.left;
const height = (b: Box) => b.bottom - b.top;

/**
 * 一条轴上的缩放倍率:标点之间的距离随缩放伸缩,标签那截固定像素不随缩放变,
 * 所以能用的空间是「安全区 − 两侧固定占位」,拿它去比标点跨距。
 * 固定占位本身就吃满安全区时缩放救不了(返回 1),交给平移尽量摆正。
 */
function axisScale(spread: number, padLow: number, padHigh: number, safe: number): number {
  if (spread <= 0) return 1;
  const usable = safe - padLow - padHigh - FIT_SLACK;
  if (usable <= 0) return 1;
  return usable / spread;
}

/** 把 [low, high] 这段推进 [safeLow, safeHigh] 需要的平移量;推不进去(比安全区还长)就居中 */
function axisShift(low: number, high: number, safeLow: number, safeHigh: number): number {
  if (high - low > safeHigh - safeLow) return (safeLow + safeHigh) / 2 - (low + high) / 2;
  if (low < safeLow) return safeLow - low;
  if (high > safeHigh) return safeHigh - high;
  return 0;
}

/**
 * 算出把「标点连同标签」整个收进安全区还需要做的缩放 + 平移。
 *
 * @param spread  标点点位的包围盒(容器坐标),随缩放伸缩
 * @param painted 连标签在内的实际绘制包围盒(容器坐标),= spread 四周各鼓出一截固定像素
 * @param safe    浮层让开后的安全区(容器坐标)
 * @param center  缩放中心(地图容器中心;setZoom 保持中心点不动)
 */
export function planFitCorrection(
  spread: Box,
  painted: Box,
  safe: Box,
  center: { x: number; y: number },
): FitCorrection {
  if (width(safe) <= 0 || height(safe) <= 0) return NO_CORRECTION;

  // 标签相对标点鼓出来的那一截(量出来的,不估)
  const padLeft = Math.max(0, spread.left - painted.left);
  const padRight = Math.max(0, painted.right - spread.right);
  const padTop = Math.max(0, spread.top - painted.top);
  const padBottom = Math.max(0, painted.bottom - spread.bottom);

  const raw = Math.min(
    1,
    axisScale(width(spread), padLeft, padRight, width(safe)),
    axisScale(height(spread), padTop, padBottom, height(safe)),
  );
  const scale = Math.max(MIN_SCALE, raw);

  // setZoom 保持中心点不动:容器里任意一点 p 缩放后落到 center + (p - center) * scale
  const at = (p: number, c: number) => c + (p - c) * scale;
  const scaled: Box = {
    left: at(spread.left, center.x) - padLeft,
    right: at(spread.right, center.x) + padRight,
    top: at(spread.top, center.y) - padTop,
    bottom: at(spread.bottom, center.y) + padBottom,
  };

  const dx = axisShift(scaled.left, scaled.right, safe.left, safe.right);
  const dy = axisShift(scaled.top, scaled.bottom, safe.top, safe.bottom);

  return {
    scale: Math.abs(1 - scale) < SCALE_EPSILON ? 1 : scale,
    // 取整往「让得更多」的方向走:往回舍会差出零点几像素,而判据是整个框必须在安全区内
    dx: Math.abs(dx) < SHIFT_EPSILON ? 0 : outward(dx),
    dy: Math.abs(dy) < SHIFT_EPSILON ? 0 : outward(dy),
  };
}

/** 计划是不是「什么都不用做」——调用方据此判定取景已到位、可以停止逐帧校正 */
export function isSettled(plan: FitCorrection): boolean {
  return plan.scale === 1 && plan.dx === 0 && plan.dy === 0;
}

/** 把一组矩形并成一个包围盒;一个都没有时返回 undefined */
export function unionBox(boxes: Box[]): Box | undefined {
  let acc: Box | undefined;
  for (const b of boxes) {
    if (!acc) acc = { ...b };
    else {
      acc.left = Math.min(acc.left, b.left);
      acc.top = Math.min(acc.top, b.top);
      acc.right = Math.max(acc.right, b.right);
      acc.bottom = Math.max(acc.bottom, b.bottom);
    }
  }
  return acc;
}

/** 判定 inner 是否完整落在 outer 里(校正是否真的到位,守卫与运行时用同一判据) */
export function contains(outer: Box, inner: Box): boolean {
  return (
    inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.right <= outer.right &&
    inner.bottom <= outer.bottom
  );
}

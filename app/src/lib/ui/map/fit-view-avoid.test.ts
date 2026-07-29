import { describe, it, expect } from "vitest";

import { fitViewAvoid, type Rect } from "./fit-view-avoid";

// round-01 N12 防回归:/traffic/parking 的 4 个标点都上了图,但默认视野下 2 个被页面自家的
// 浮层卡压住(西门停车场压在左上 KPI 卡下、东门生态停车场压在右侧数据面板下),
// 1324×804 与 1440×900 两档都复现,1920 以上才全露。
//
// 判据取「fitView 的安全区与任何一张浮层都不相交」——只要成立,标点就不可能落到浮层底下,
// 比断言某个具体内缩数值稳(卡片高度随内容变,数值一改测试就得跟着改,守不住任何东西)。

const rect = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * 一档真实布局:侧边导航 240px、顶栏 64px,浮层按 map-overlay 的类名摆位
 * (KPI 卡 left-4 top-4、图例 bottom-4 left-4、数据面板 right-4 top-4 bottom-4 w-360)。
 * 尺寸取 tester 在演示服务器上实测的那组(KPI 卡 360×101、面板 360×708)。
 */
function layout(viewportWidth: number, viewportHeight: number) {
  const SIDEBAR = 240;
  const TOPBAR = 64;
  const INSET = 16;
  const PANEL_W = 360;
  const base = rect(SIDEBAR, TOPBAR, viewportWidth - SIDEBAR, viewportHeight - TOPBAR);
  const kpi = rect(base.left + INSET, base.top + INSET, 360, 101);
  const legend = rect(base.left + INSET, base.bottom - INSET - 34, 200, 34);
  const panel = rect(base.right - INSET - PANEL_W, base.top + INSET, PANEL_W, base.bottom - base.top - 2 * INSET);
  return { base, overlays: [kpi, legend, panel] };
}

/** 收起态:右侧面板缩成右上角的「展开数据面板」浮钮 */
function layoutCollapsed(viewportWidth: number, viewportHeight: number) {
  const { base, overlays } = layout(viewportWidth, viewportHeight);
  const toggle = rect(base.right - 16 - 150, base.top + 16, 150, 36);
  return { base, overlays: [overlays[0], overlays[1], toggle] };
}

function safeArea(base: Rect, overlays: Rect[]): Rect {
  const avoid = fitViewAvoid(base, overlays);
  expect(avoid).toBeDefined();
  const [top, bottom, left, right] = avoid as [number, number, number, number];
  return { top: base.top + top, bottom: base.bottom - bottom, left: base.left + left, right: base.right - right };
}

const VIEWPORTS: [name: string, w: number, h: number][] = [
  ["1324×804(tester 实测,2/4 被遮)", 1324, 804],
  ["1440×900(tester 实测,2/4 被遮)", 1440, 900],
  ["1920×1080", 1920, 1080],
  ["2560×1440", 2560, 1440],
];

describe("N12 fitView 安全区避开整页地图的浮层", () => {
  it.each(VIEWPORTS)("%s:面板展开时安全区不与任何浮层相交", (_name, w, h) => {
    const { base, overlays } = layout(w, h);
    const safe = safeArea(base, overlays);
    expect(overlays.filter((o) => overlaps(safe, o))).toEqual([]);
    // 让开之后还得剩下能用的取景区,否则等于把地图缩没了
    expect(safe.right - safe.left).toBeGreaterThan(200);
    expect(safe.bottom - safe.top).toBeGreaterThan(200);
  });

  it.each(VIEWPORTS)("%s:面板收起成浮钮时同样不相交", (_name, w, h) => {
    const { base, overlays } = layoutCollapsed(w, h);
    const safe = safeArea(base, overlays);
    expect(overlays.filter((o) => overlaps(safe, o))).toEqual([]);
  });

  it("左上角那张卡从上边让开(376px 的左内缩同样避得开,但白丢三倍视野)", () => {
    const { base, overlays } = layout(1440, 900);
    const [, , left] = fitViewAvoid(base, overlays) as [number, number, number, number];
    expect(left).toBeLessThan(100);
  });

  // 守卫自证:同一套判据加在缺陷版(不传 avoid,高德默认 [60,60,60,60])上必须是红的,
  // 否则这条测试就算写了也拦不住 N12 再次发生。
  it.each(VIEWPORTS.slice(0, 2))("%s:缺陷版(高德默认避让)确实压住浮层", (_name, w, h) => {
    const { base, overlays } = layout(w, h);
    const AMAP_DEFAULT = 60;
    const old = {
      top: base.top + AMAP_DEFAULT,
      bottom: base.bottom - AMAP_DEFAULT,
      left: base.left + AMAP_DEFAULT,
      right: base.right - AMAP_DEFAULT,
    };
    expect(overlays.filter((o) => overlaps(old, o)).length).toBeGreaterThan(0);
  });

  it("没有浮层时返回 undefined —— 大屏各图仍走高德默认避让,取景不变", () => {
    expect(fitViewAvoid(rect(0, 0, 800, 600), [])).toBeUndefined();
    // 收起/未渲染的零尺寸元素不算浮层
    expect(fitViewAvoid(rect(0, 0, 800, 600), [rect(10, 10, 0, 0)])).toBeUndefined();
    // 落在地图区域外的浮层也不用避让
    expect(fitViewAvoid(rect(0, 0, 800, 600), [rect(900, 10, 100, 40)])).toBeUndefined();
  });

  it("浮层大到盖住整屏时内缩仍有上限,不会把取景区压成空", () => {
    const base = rect(0, 0, 400, 300);
    const avoid = fitViewAvoid(base, [rect(0, 0, 400, 300)]) as [number, number, number, number];
    const [top, bottom, left, right] = avoid;
    expect(top + bottom).toBeLessThan(300);
    expect(left + right).toBeLessThan(400);
  });
});

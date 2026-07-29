import { describe, it, expect } from "vitest";

import { estimateLabelExtent, fitViewAvoid, type MarkerExtent, type Rect } from "./fit-view-avoid";

// round-01 N12 防回归。这条缺陷复发过一次,两轮的判据不一样,都要守:
//
// r9(一轮):/traffic/parking 的 4 个标点都上了图,却有 2 个被页面自家浮层卡压住
//   (西门压在左上 KPI 卡下、东门压在右侧数据面板下),1324×804 与 1440×900 都复现。
// r13(复验):≥1440 已修好,**1324×804 仍复现 2/4**,而且西门这次是被**左侧导航栏**挡住的——
//   导航栏在地图容器之外,即标签向左溢出了地图可视区边缘。上一轮只把标点当成"点"来避让,
//   没算它旁边那张 100~150px 宽的标签。
//
// 所以判据从「安全区不与浮层相交」升级为:**把标点连同它的标签整个框起来,这个框
// 既不许碰到任何浮层,也不许越出地图容器**——只要成立,标点和它的字就都看得见。

const rect = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const contains = (outer: Rect, inner: Rect) =>
  inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;

/** tester 实测的那两条停车场标签(最长的一条决定占位) */
const PARKING_LABELS = ["西门停车场 0/200", "东门生态停车场 120/300", "主峰临时停车场 75/120", "游客中心地下车库 150/150"];
const EXTENT = estimateLabelExtent(PARKING_LABELS);

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

function safeArea(base: Rect, overlays: Rect[], extent?: MarkerExtent): Rect {
  const avoid = fitViewAvoid(base, overlays, extent);
  expect(avoid).toBeDefined();
  const [top, bottom, left, right] = avoid as [number, number, number, number];
  return { top: base.top + top, bottom: base.bottom - bottom, left: base.left + left, right: base.right - right };
}

/**
 * 安全区的四个角各放一个标点,把「标点 + 标签」整个框出来。
 * fitView 会把标点铺到安全区边缘,所以角上这四个就是最容易出界的那几个。
 */
function markerBoxes(safe: Rect, extent: MarkerExtent): Rect[] {
  const corners: [number, number][] = [
    [safe.left, safe.top],
    [safe.right, safe.top],
    [safe.left, safe.bottom],
    [safe.right, safe.bottom],
  ];
  return corners.map(([x, y]) => ({
    left: x - extent.side,
    right: x + extent.side,
    top: y - extent.above,
    bottom: y + extent.below,
  }));
}

const VIEWPORTS: [name: string, w: number, h: number][] = [
  ["1324×804(tester 实测,r9 2/4 被遮、r13 仍 2/4)", 1324, 804],
  ["1440×900(tester 实测,r9 2/4 被遮、r13 已修好)", 1440, 900],
  ["1920×1080", 1920, 1080],
  ["2560×1440", 2560, 1440],
];

describe("N12 fitView 安全区避开整页地图的浮层", () => {
  it.each(VIEWPORTS)("%s:面板展开时安全区不与任何浮层相交", (_name, w, h) => {
    const { base, overlays } = layout(w, h);
    const safe = safeArea(base, overlays, EXTENT);
    expect(overlays.filter((o) => overlaps(safe, o))).toEqual([]);
    // 让开之后还得剩下能用的取景区,否则等于把地图缩没了
    expect(safe.right - safe.left).toBeGreaterThan(200);
    expect(safe.bottom - safe.top).toBeGreaterThan(200);
  });

  it.each(VIEWPORTS)("%s:面板收起成浮钮时同样不相交", (_name, w, h) => {
    const { base, overlays } = layoutCollapsed(w, h);
    const safe = safeArea(base, overlays, EXTENT);
    expect(overlays.filter((o) => overlaps(safe, o))).toEqual([]);
  });

  it("左上角那张卡从上边让开(376px 的左内缩同样避得开,但白丢三倍视野)", () => {
    const { base, overlays } = layout(1440, 900);
    const [, , left] = fitViewAvoid(base, overlays, EXTENT) as [number, number, number, number];
    // 只该让出半个标签宽 + 呼吸位,不该整条 KPI 卡宽度都让掉
    expect(left).toBeLessThan(100);
  });
});

// r13 的新判据:标点的**标签**也不许被遮、不许出界。上一轮漏的就是这一层。
describe("N12 r13 标点连同标签整个落在可视区内", () => {
  it.each(VIEWPORTS)("%s:展开态四角标点的标签既不出容器、也不碰浮层", (_name, w, h) => {
    const { base, overlays } = layout(w, h);
    const safe = safeArea(base, overlays, EXTENT);
    for (const box of markerBoxes(safe, EXTENT)) {
      expect(contains(base, box), "标签溢出地图可视区(r13:西门那张跑到左侧导航栏底下)").toBe(true);
      expect(overlays.filter((o) => overlaps(box, o)), "标签探进浮层").toEqual([]);
    }
  });

  it.each(VIEWPORTS)("%s:收起态同样成立", (_name, w, h) => {
    const { base, overlays } = layoutCollapsed(w, h);
    const safe = safeArea(base, overlays, EXTENT);
    for (const box of markerBoxes(safe, EXTENT)) {
      expect(contains(base, box)).toBe(true);
      expect(overlays.filter((o) => overlaps(box, o))).toEqual([]);
    }
  });

  // 自证 ①:高德默认避让(缺陷原版)必须红
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

  // 自证 ②:上一轮的修法(只避浮层、不算标签占位)在 1324×804 下必须红——
  // 否则这条守卫拦不住 r13 复现的那一幕。
  it("1324×804:上一轮只避浮层的版本,标签确实出界/被遮", () => {
    const { base, overlays } = layout(1324, 804);
    const safe = safeArea(base, overlays); // 不传 extent = 上一轮行为
    const bad = markerBoxes(safe, EXTENT).filter(
      (box) => !contains(base, box) || overlays.some((o) => overlaps(box, o)),
    );
    expect(bad.length).toBeGreaterThan(0);
  });
});

describe("N12 边界:没有要避的东西就不改取景", () => {
  it("没有浮层、也没有标签时返回 undefined —— 大屏各图仍走高德默认避让,取景不变", () => {
    expect(fitViewAvoid(rect(0, 0, 800, 600), [])).toBeUndefined();
    // 收起/未渲染的零尺寸元素不算浮层
    expect(fitViewAvoid(rect(0, 0, 800, 600), [rect(10, 10, 0, 0)])).toBeUndefined();
    // 落在地图区域外的浮层也不用避让
    expect(fitViewAvoid(rect(0, 0, 800, 600), [rect(900, 10, 100, 40)])).toBeUndefined();
  });

  it("只有标签没有浮层时也要让位(标签照样会溢出容器边缘)", () => {
    const avoid = fitViewAvoid(rect(0, 0, 800, 600), [], EXTENT);
    expect(avoid).toBeDefined();
    const [top, , left, right] = avoid as [number, number, number, number];
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
    expect(top).toBeGreaterThan(0);
  });

  it("浮层大到盖住整屏时内缩仍有上限,不会把取景区压成空", () => {
    const base = rect(0, 0, 400, 300);
    const avoid = fitViewAvoid(base, [rect(0, 0, 400, 300)], EXTENT) as [number, number, number, number];
    const [top, bottom, left, right] = avoid;
    expect(top + bottom).toBeLessThan(300);
    expect(left + right).toBeLessThan(400);
  });
});

describe("N12 标签占位估算", () => {
  it("中文按一个字宽、西文数字按 0.6 估,取最长的一条", () => {
    const one = estimateLabelExtent(["西门停车场 0/200"]);
    const longer = estimateLabelExtent(["西门停车场 0/200", "东门生态停车场 120/300"]);
    expect(longer.side).toBeGreaterThan(one.side);
  });

  it("估出来的宽度覆盖 tester 实测的 101~150px 区间(估小了就是 N12 复发)", () => {
    // tester 实测 .amap-marker-label 为 101×27 ~ 150×27
    expect(estimateLabelExtent(PARKING_LABELS).side * 2).toBeGreaterThanOrEqual(150);
  });

  it("空标签列表不产生任何占位(否则无标签的调用点也会被改掉取景)", () => {
    expect(estimateLabelExtent([])).toEqual({ side: 0, above: 0, below: 0 });
    expect(fitViewAvoid(rect(0, 0, 800, 600), [], estimateLabelExtent([]))).toBeUndefined();
  });
});

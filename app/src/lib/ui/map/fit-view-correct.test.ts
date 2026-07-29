import { describe, it, expect } from "vitest";

import { estimateLabelExtent, overlaySafeArea, type MarkerExtent, type Rect } from "./fit-view-avoid";
import { contains, isSettled, planFitCorrection, unionBox, type Box } from "./fit-view-correct";

// round-01 N12 第三轮防回归。
//
// 前两轮的守卫(fit-view-avoid.test.ts)守的是「avoid 算得对不对」——两轮都绿,真机两轮都还是
// 1324×804 / 1440×900 下 2/4 被遮挡(r13、r17)。原因不在几何,在于**算出来的内缩**和
// **标点最后落在屏幕哪儿**之间有落差:r17 实测西门那张标签 rect.x=174,而地图容器 x=240,
// 标签左缘直接落到容器外面去了 —— 内缩要求它离左缘 99px,实际只有 -66px。
//
// 所以这一轮换判据:不再假设摆得准,而是**摆完去量,量到越界就收回来**。
// 这份守卫守的就是那一步:给定「量到的标点框 + 标签框 + 安全区」,校正必须把整个绘制框收进安全区,
// 并且**只在真的越界时动**(否则大屏那些本来就好好的取景会被无谓地改掉)。

const rect = (left: number, top: number, width: number, height: number): Rect => ({
  left, top, right: left + width, bottom: top + height,
});

/** tester 实测的那四条停车场标签(最长的一条决定占位) */
const PARKING_LABELS = ["西门停车场 0/200", "东门生态停车场 120/300", "主峰临时停车场 75/120", "游客中心地下车库 150/150"];
const EXTENT = estimateLabelExtent(PARKING_LABELS);

/** 与 fit-view-avoid.test.ts 同一套真实布局:侧边导航 240、顶栏 64、KPI 卡 360×101、面板 360 宽 */
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

const paint = (spread: Box, e: MarkerExtent): Box => ({
  left: spread.left - e.side,
  right: spread.right + e.side,
  top: spread.top - e.above,
  bottom: spread.bottom + e.below,
});

const scaleAbout = (b: Box, c: { x: number; y: number }, s: number): Box => ({
  left: c.x + (b.left - c.x) * s,
  right: c.x + (b.right - c.x) * s,
  top: c.y + (b.top - c.y) * s,
  bottom: c.y + (b.bottom - c.y) * s,
});

const shift = (b: Box, dx: number, dy: number): Box => ({
  left: b.left + dx, right: b.right + dx, top: b.top + dy, bottom: b.bottom + dy,
});

/**
 * 模拟运行时那圈逐帧校正:每帧重新量(这里即重新算 painted)、要一次计划、**只施加一个动作**
 * (要缩放就缩放,否则平移),下一帧再来 —— 与 AmapContainer.correctFitOnce 的节奏一致。
 */
function converge(spread0: Box, extent: MarkerExtent, safe: Box, center: { x: number; y: number }) {
  let spread = spread0;
  for (let pass = 0; pass < 12; pass++) {
    const painted = paint(spread, extent);
    const plan = planFitCorrection(spread, painted, safe, center);
    if (isSettled(plan)) return { spread, painted, passes: pass };
    spread = plan.scale !== 1 ? scaleAbout(spread, center, plan.scale) : shift(spread, plan.dx, plan.dy);
  }
  return { spread, painted: paint(spread, extent), passes: 12 };
}

const VIEWPORTS: ReadonlyArray<readonly [string, number, number]> = [
  ["1324×804(1440×900 笔记本减浏览器边框,PRD §四① 的最小支持档)", 1324, 804],
  ["1440×900", 1440, 900],
  ["1920×1080", 1920, 1080],
  ["2560×1440", 2560, 1440],
];

/** 容器局部坐标下的安全区 + 容器中心 */
function frame(base: Rect, overlays: Rect[]) {
  const width = base.right - base.left;
  const height = base.bottom - base.top;
  return {
    safe: overlaySafeArea(base, overlays),
    center: { x: width / 2, y: height / 2 },
    width,
    height,
  };
}

/**
 * r17 真机实测到的那一幕(容器局部坐标):
 * 西门标签左缘落在容器外 66px(1324)/ 8px(1440),东门标点探进右侧数据面板。
 * 这是「按 avoid 摆完之后屏幕上的样子」,校正要从这里把它收回来。
 */
function observedSpread(f: ReturnType<typeof frame>, overflowLeft: number, panelLeftLocal: number): Box {
  const y = f.height / 2;
  return {
    left: -overflowLeft + EXTENT.side, // painted.left = -overflowLeft
    right: panelLeftLocal + 100,       // 探进面板 100px
    top: y,
    bottom: y,
  };
}

describe("N12 r17 复现位:量到越界就必须收回来", () => {
  it.each([
    ["1324×804(西门标签溢出容器左缘 66px)", 1324, 804, 66],
    ["1440×900(西门标签溢出容器左缘 8px)", 1440, 900, 8],
  ])("%s", (_name, vw, vh, overflow) => {
    const { base, overlays } = layout(vw, vh);
    const f = frame(base, overlays);
    const panelLeftLocal = overlays[2].left - base.left;
    const start = observedSpread(f, overflow as number, panelLeftLocal);

    // 自证:这就是 r17 那一幕——不做校正的话,绘制框确实不在安全区里
    expect(contains(f.safe, paint(start, EXTENT))).toBe(false);

    const done = converge(start, EXTENT, f.safe, f.center);
    expect(contains(f.safe, done.painted), `校正后仍越界:${JSON.stringify(done.painted)}`).toBe(true);
    expect(done.passes).toBeLessThan(12);
  });
});

describe("N12 四档分辨率 × 面板展开/收起:标点铺满安全区时也不许溢出", () => {
  const cases = VIEWPORTS.flatMap(([name, w, h]) => [
    [`${name} · 展开`, layout(w, h)] as const,
    [`${name} · 收起`, layoutCollapsed(w, h)] as const,
  ]);

  it.each(cases)("%s", (_name, { base, overlays }) => {
    const f = frame(base, overlays);
    // 最坏情形:高德把标点一路铺到容器四角(不理会我们要的内缩)
    const start: Box = { left: 0, top: 0, right: f.width, bottom: f.height };
    expect(contains(f.safe, paint(start, EXTENT))).toBe(false);

    const done = converge(start, EXTENT, f.safe, f.center);
    expect(contains(f.safe, done.painted)).toBe(true);
  });
});

describe("只在越界时动:本来就摆好的取景一个像素都不许改", () => {
  it.each(VIEWPORTS)("%s", (_name, w, h) => {
    const { base, overlays } = layout(w, h);
    const f = frame(base, overlays);
    // 标点连标签整个落在安全区内
    const spread: Box = {
      left: f.safe.left + EXTENT.side + 10,
      right: f.safe.right - EXTENT.side - 10,
      top: f.safe.top + EXTENT.above + 10,
      bottom: f.safe.bottom - EXTENT.below - 10,
    };
    expect(isSettled(planFitCorrection(spread, paint(spread, EXTENT), f.safe, f.center))).toBe(true);
  });

  // 大屏三处与 /traffic/road 不传 label、也没有 data-map-overlay 浮层:
  // 安全区就是整个容器,标点由高德默认避让摆在里面 —— 校正必须是彻底的空操作
  it("无浮层无标签(大屏/路况页的形状):校正为空操作", () => {
    const base = rect(0, 0, 1920, 1080);
    const safe = overlaySafeArea(base, []);
    const spread: Box = { left: 300, top: 200, right: 1500, bottom: 900 };
    const plan = planFitCorrection(spread, spread, safe, { x: 960, y: 540 });
    expect(isSettled(plan)).toBe(true);
  });
});

describe("边界与退化情形", () => {
  const base = rect(240, 64, 1084, 740);
  const f = frame(base, layout(1324, 804).overlays);

  it("只有一个标点(跨距为 0)时只平移、不缩放", () => {
    const spread: Box = { left: 5, top: 5, right: 5, bottom: 5 };
    const plan = planFitCorrection(spread, paint(spread, EXTENT), f.safe, f.center);
    expect(plan.scale).toBe(1);
    expect(plan.dx).toBeGreaterThan(0);
    const done = converge(spread, EXTENT, f.safe, f.center);
    expect(contains(f.safe, done.painted)).toBe(true);
  });

  it("标签宽到安全区都装不下时不做无意义的缩放(缩到 0 也没用),但仍居中摆放", () => {
    const huge: MarkerExtent = { side: 5000, above: 5000, below: 5000 };
    const spread: Box = { left: 100, top: 100, right: 200, bottom: 200 };
    const plan = planFitCorrection(spread, paint(spread, huge), f.safe, f.center);
    expect(plan.scale).toBe(1);
    expect(Number.isFinite(plan.dx) && Number.isFinite(plan.dy)).toBe(true);
  });

  it("安全区退化(浮层吃满整屏)时不抛异常、也不乱动", () => {
    const degenerate: Box = { left: 10, top: 10, right: 10, bottom: 10 };
    expect(isSettled(planFitCorrection({ left: 0, top: 0, right: 100, bottom: 100 }, { left: 0, top: 0, right: 100, bottom: 100 }, degenerate, f.center))).toBe(true);
  });

  it("unionBox:空集返回 undefined,多个框取并集", () => {
    expect(unionBox([])).toBeUndefined();
    expect(unionBox([{ left: 1, top: 2, right: 3, bottom: 4 }, { left: -1, top: 5, right: 2, bottom: 9 }]))
      .toEqual({ left: -1, top: 2, right: 3, bottom: 9 });
  });
});

describe("overlaySafeArea 与 fitViewAvoid 共用同一份浮层几何", () => {
  it("安全区确实把三张浮层都让开了(容器局部坐标)", () => {
    const { base, overlays } = layout(1324, 804);
    const safe = overlaySafeArea(base, overlays);
    for (const o of overlays) {
      const local = { left: o.left - base.left, top: o.top - base.top, right: o.right - base.left, bottom: o.bottom - base.top };
      const intersects = safe.left < local.right && local.left < safe.right && safe.top < local.bottom && local.top < safe.bottom;
      expect(intersects, `安全区与浮层 ${JSON.stringify(local)} 相交`).toBe(false);
    }
  });
});

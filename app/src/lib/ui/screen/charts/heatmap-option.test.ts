import * as echarts from "echarts";
import { describe, it, expect } from "vitest";

import { SCREEN_THEME, ensureScreenTheme } from "../echarts-theme";
import {
  SCREEN_HEATMAP_PALETTE,
  backstageHeatmapPalette,
  buildHeatmapOption,
  type HeatmapPalette,
} from "./heatmap-option";

// round-01 N13 防回归:大屏三块热力矩阵(/screen/heatmap、/screen/poster、/screen/command)
// 一格都画不出来,整片空白且无降级提示,控制台稳定抛
//   TypeError: Cannot read properties of null (reading 'length') at splitArea
// 根因:大屏变体的 splitArea 色值缺省,option 里下发了 `areaStyle: undefined`,
// 把默认主题里配好的 areaStyle.color 覆盖成空,echarts 读 color.length 时炸开、
// 整个 axis view 渲染中断。后台变体给的是真数组,所以只崩大屏。
//
// ⚠️ 这条为什么以前测不出来:老守卫(heatmap-layout.test.ts)自己手搓了一份 option 去渲染,
// 和组件真正下发的那份是两码事;组件里 option 写错了它照样绿。所以这里渲染的必须是
// buildHeatmapOption 的产物本身,且**每个变体都要过**——只验后台变体正是当初漏掉 N13 的原因。

const MATRIX = Array.from({ length: 7 }, (_, dow) => Array.from({ length: 24 }, (_, h) => (h * 7 + dow) % 63));
const CELLS = 7 * 24;

// 变体 × 主题,与线上调用一一对应:
// 大屏(SCREEN_THEME,/screen/*) / 后台浅色 / 后台深色(theme=null,/analytics/heatmap)
const VARIANTS: [name: string, pal: HeatmapPalette, theme: string | undefined][] = [
  ["大屏 dark(注册主题)", SCREEN_HEATMAP_PALETTE, SCREEN_THEME],
  ["后台 light", backstageHeatmapPalette(false), undefined],
  ["后台 dark", backstageHeatmapPalette(true), undefined],
];

// 各调用点的真实画布尺寸(大屏三块 + 后台卡片)
const CANVASES: [name: string, width: number, height: number][] = [
  ["大屏 /screen/heatmap", 1600, 620],
  ["大屏 /screen/poster", 760, 280],
  ["大屏 /screen/command", 900, 270],
  ["后台 /analytics/heatmap", 1150, 340],
];

function renderToSVG(pal: HeatmapPalette, theme: string | undefined, width: number, height: number) {
  ensureScreenTheme();
  const chart = echarts.init(null, theme ?? null, { renderer: "svg", ssr: true, width, height });
  try {
    chart.setOption({ ...buildHeatmapOption({ matrix: MATRIX, pal }), animation: false });
    return chart.renderToSVGString();
  } finally {
    chart.dispose();
  }
}

describe("N13 热力矩阵每个变体都真画得出来", () => {
  it.each(
    VARIANTS.flatMap(([vName, pal, theme]) =>
      CANVASES.map(([cName, w, h]) => [`${vName} @ ${cName}`, pal, theme, w, h] as const),
    ),
  )("%s:渲染不抛异常,且 7×24 格全部画出", (_name, pal, theme, width, height) => {
    // 缺陷版本在 setOption 里就抛了,连一个图元都产不出来 —— 这一步本身就是主判据
    const svg = renderToSVG(pal, theme, width, height);
    // 「非空画面」的 SVG 等价物:热力格是逐格绘制的图元,少于格子数即说明矩阵没画全
    const shapes = (svg.match(/<(?:path|rect)\b/g) ?? []).length;
    expect(shapes).toBeGreaterThanOrEqual(CELLS);
  });
});

describe("N13 根因守卫:splitArea 色值不得为空", () => {
  it.each(VARIANTS)("%s:两条轴的 splitArea.areaStyle.color 都是非空数组", (_name, pal) => {
    // 配色表这一层:缺省即回归
    expect(Array.isArray(pal.splitArea)).toBe(true);
    expect(pal.splitArea.length).toBeGreaterThan(0);

    // option 这一层:areaStyle 要么带非空 color,要么整个键不下发(让主题生效);
    // 绝不允许 `areaStyle: undefined` —— 那会把主题值覆盖成空并让 echarts 崩
    const option = buildHeatmapOption({ matrix: MATRIX, pal }) as {
      xAxis: { splitArea?: { areaStyle?: { color?: unknown } } };
      yAxis: { splitArea?: { areaStyle?: { color?: unknown } } };
    };
    for (const axis of [option.xAxis, option.yAxis]) {
      const areaStyle = axis.splitArea?.areaStyle;
      expect(areaStyle).toBeDefined();
      expect(Array.isArray(areaStyle?.color)).toBe(true);
      expect((areaStyle?.color as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it("x/y 两轴各持一份 splitArea 对象,不共用引用(echarts 就地 merge 会互相污染)", () => {
    const option = buildHeatmapOption({ matrix: MATRIX, pal: SCREEN_HEATMAP_PALETTE }) as {
      xAxis: { splitArea?: unknown };
      yAxis: { splitArea?: unknown };
    };
    expect(option.xAxis.splitArea).not.toBe(option.yAxis.splitArea);
  });

  it("色值来源也不共用引用:改 option 不会改到配色表", () => {
    const option = buildHeatmapOption({ matrix: MATRIX, pal: SCREEN_HEATMAP_PALETTE }) as {
      xAxis: { splitArea?: { areaStyle?: { color?: unknown } } };
    };
    expect(option.xAxis.splitArea?.areaStyle?.color).not.toBe(SCREEN_HEATMAP_PALETTE.splitArea);
  });
});

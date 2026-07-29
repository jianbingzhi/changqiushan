import * as echarts from "echarts";
import { describe, it, expect } from "vitest";

import { SCREEN_THEME, ensureScreenTheme } from "../echarts-theme";
import { resolveHourStep } from "./heatmap-layout";
import {
  DEFAULT_DOW,
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

// 各调用点的真实画布尺寸(大屏三块 + 后台卡片)。
// ⚠️ /screen/command 这一行原本写的是 900×270 —— 那是估的,实测只有 424×230
// (热力块在 60fr/40fr 分栏里),差了一倍多。round-01 N20(X 轴刻度粘连)只在 424 宽下发作,
// 守卫按 900 渲染自然一次都没红过。**调用点尺寸变了就要回来改这张表**,否则下面所有几何守卫都在量一块不存在的画布。
const CANVASES: [name: string, width: number, height: number][] = [
  ["大屏 /screen/heatmap", 1600, 620],
  ["大屏 /screen/poster", 760, 280],
  ["大屏 /screen/command", 424, 230],
  ["后台 /analytics/heatmap", 1150, 340],
];

function renderToSVG(pal: HeatmapPalette, theme: string | undefined, width: number, height: number) {
  ensureScreenTheme();
  const chart = echarts.init(null, theme ?? null, { renderer: "svg", ssr: true, width, height });
  try {
    // width 传的就是画布宽 —— 组件在浏览器里量到什么就传什么(Heatmap724 的 ResizeObserver)
    chart.setOption({ ...buildHeatmapOption({ matrix: MATRIX, pal, width }), animation: false });
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

// round-01 N15 防回归:大屏三块热力矩阵的 X 轴刻度正常,Y 轴「周一…周日」七行标签一个都没有,
// 7 行分不清是哪天。根因与 N13 同源——`yAxis.axisLabel` 被显式赋成 undefined(大屏 axisText 留空),
// 把注册主题里的 axisLabel 覆盖成空;xAxis 因为写成 `{ interval: 1, ...style }` 展开后仍是对象而幸免。
//
// 判据取「标签文字真的出现在渲染产物里」,而不是「option 里那个键长什么样」:
// N15 的教训正是 option 看着"有配色就传、没配色就不传",结果渲染出来少了一整条轴的字。
describe("N15 两条轴的刻度标签都必须真渲染出来", () => {
  it.each(
    VARIANTS.flatMap(([vName, pal, theme]) =>
      CANVASES.map(([cName, w, h]) => [`${vName} @ ${cName}`, pal, theme, w, h] as const),
    ),
  )("%s:Y 轴七天标签齐全,X 轴刻度也在", (_name, pal, theme, width, height) => {
    const svg = renderToSVG(pal, theme, width, height);
    for (const dow of DEFAULT_DOW) {
      expect(svg, `Y 轴缺「${dow}」`).toContain(dow);
    }
    // X 轴:interval:1 隔一个画一个,首刻度必在
    expect(svg, "X 轴缺「0时」").toContain("0时");
  });

  it.each(VARIANTS)("%s:axisLabel 键要么带色值、要么是空对象,绝不是 undefined", (_name, pal) => {
    const option = buildHeatmapOption({ matrix: MATRIX, pal }) as {
      xAxis: { axisLabel?: unknown };
      yAxis: { axisLabel?: unknown };
    };
    for (const axisLabel of [option.xAxis.axisLabel, option.yAxis.axisLabel]) {
      expect(axisLabel).toBeDefined();
      expect(typeof axisLabel).toBe("object");
    }
    // 同 splitArea:两条轴不共用同一个对象,免得 echarts 就地 merge 时互相污染
    expect(option.xAxis.axisLabel).not.toBe(option.yAxis.axisLabel);
  });

  // X 轴刻度的疏密由 N20 那组守卫单独看(下面),这里只管「标签必须真渲染出来」。

  // 守卫自证:退回缺陷写法(大屏 axisText 为空 → yAxis.axisLabel = undefined)必须让上面那条转红,
  // 否则这条测试写了也拦不住 N15 再次发生。
  it("自证:缺陷写法下大屏 Y 轴标签确实消失", () => {
    ensureScreenTheme();
    const buggy = {
      ...buildHeatmapOption({ matrix: MATRIX, pal: SCREEN_HEATMAP_PALETTE }),
      yAxis: {
        type: "category" as const,
        data: DEFAULT_DOW,
        splitArea: { show: true, areaStyle: { color: [...SCREEN_HEATMAP_PALETTE.splitArea] } },
        axisLabel: undefined,
      },
      animation: false,
    };
    const chart = echarts.init(null, SCREEN_THEME, { renderer: "svg", ssr: true, width: 1600, height: 620 });
    try {
      chart.setOption(buggy);
      const svg = chart.renderToSVGString();
      expect(DEFAULT_DOW.some((d) => svg.includes(d))).toBe(false);
    } finally {
      chart.dispose();
    }
  });
});

// round-01 N20 防回归:/screen/command 的热力块被分栏压到 424×230,X 轴仍写死每 2 小时一个刻度,
// 大屏 14px 字号下「22时」占 ~30px、而每格只有 12.7px ⇒ 8时 往后「10时12时14时…」连成一片。
//
// 判据同样取渲染产物的真实坐标(N10 那套做法),不看 option 里 interval 写了几:
// 刻度疏密最终由「字号 × 容器宽 × grid 留白」三者共同决定,只断言 interval 的值等于什么都没验。
//
// ⚠️ 另一半判据同等重要:宽画布(整屏版 1266、后台 1150、海报 760)必须**仍是每 2 小时一个**。
// 验收方明确要求别把那三处一起改稀 —— 只放宽「不重叠」会让「全都改成 6 小时一个」也蒙混过关。
describe("N20 X 轴时间刻度随容器宽自适应,窄画布不再粘连", () => {
  // 与 heatmap-layout.test.ts 同款保守估宽:CJK 按整个字号、数字按 0.55 字号,宁可估宽不估窄
  const labelHalfWidth = (t: string, fontSize: number) =>
    t.split("").reduce((w, c) => w + (/[一-龥]/.test(c) ? fontSize : fontSize * 0.55), 0) / 2;

  function hourLabels(width: number, height: number, optWidth?: number) {
    ensureScreenTheme();
    const chart = echarts.init(null, SCREEN_THEME, { renderer: "svg", ssr: true, width, height });
    try {
      chart.setOption({
        ...buildHeatmapOption({ matrix: MATRIX, pal: SCREEN_HEATMAP_PALETTE, width: optWidth }),
        animation: false,
      });
      const svg = chart.renderToSVGString();
      const out: { text: string; x0: number; x1: number }[] = [];
      const re = /<text([^>]*)>([^<]*)<\/text>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(svg))) {
        const [, attrs, text] = m;
        if (!/^\d+时$/.test(text)) continue; // X 轴时间刻度(Y 轴是「周一」…,色阶条是裸数字)
        const tr = /transform="translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)"/.exec(attrs);
        const dx = parseFloat(/\sx="([-\d.e]+)"/.exec(attrs)?.[1] ?? "0") || 0;
        const fontSize = parseFloat(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? "12");
        const cx = (tr ? Number(tr[1]) : 0) + dx;
        const hw = labelHalfWidth(text, fontSize);
        out.push({ text, x0: cx - hw, x1: cx + hw });
      }
      return out.sort((a, b) => a.x0 - b.x0);
    } finally {
      chart.dispose();
    }
  }

  // 相邻刻度之间至少要留的空白:严格「不相交」不够,差几个像素肉眼已经糊成一团(同 N10 的口径)
  const MIN_CLEARANCE = 4;

  const collisions = (labels: ReturnType<typeof hourLabels>) =>
    labels
      .slice(1)
      .map((cur, i) => ({ cur, prev: labels[i], gap: cur.x0 - labels[i].x1 }))
      .filter((p) => p.gap < MIN_CLEARANCE)
      .map((p) => `${p.prev.text}×${p.cur.text}(${p.gap.toFixed(1)}px)`);

  it.each(CANVASES)("%s(%i×%i):相邻时间刻度之间留得出空白", (_name, width, height) => {
    const labels = hourLabels(width, height, width);
    expect(labels.length).toBeGreaterThan(0);
    expect(collisions(labels)).toEqual([]);
  });

  it.each(CANVASES)("%s(%i×%i):刻度步长均匀,且落在整点钟上", (_name, width, height) => {
    const hours = hourLabels(width, height, width).map((l) => Number(l.text.replace("时", "")));
    expect(hours[0]).toBe(0); // 首刻度必是 0 时
    const steps = new Set(hours.slice(1).map((h, i) => h - hours[i]));
    expect([...steps], "步长不均匀 ⇒ 读者没法按固定间隔推算钟点").toHaveLength(1);
    expect(24 % [...steps][0], "步长必须是 24 的因数,否则刻度落不到整齐的钟点").toBe(0);
  });

  it("宽画布仍是每 2 小时一个,自适应不得把整屏版/后台版一起改稀", () => {
    // 验收方原话:「注意别把整屏版(1266×620)与后台版的刻度密度一起改稀,那两处现在是正常的」
    for (const width of [760, 1150, 1266, 1600]) {
      expect(resolveHourStep(width), `${width}px 的步长变了`).toBe(2);
    }
    // 被压到 424 的指挥屏那块才放稀,且只放到读得清为止(3 小时一个 = 8 个标签)
    expect(resolveHourStep(424)).toBe(3);
    // 宽度未知(SSR / 尚未测量)时回落到原有疏密,不因自适应变密
    expect(resolveHourStep(undefined)).toBe(2);
  });

  it("自证:退回写死 interval(不看容器宽)时 424 宽下确实粘连", () => {
    // 缺陷写法 = 组件不测宽、buildHeatmapOption 收不到 width ⇒ 步长恒为 2
    const labels = hourLabels(424, 230, undefined);
    expect(labels.map((l) => l.text)).toContain("22时"); // 12 个标签全打上了
    expect(collisions(labels).length, "这条不红就说明上面的守卫拦不住 N20 复发").toBeGreaterThan(0);
  });
});

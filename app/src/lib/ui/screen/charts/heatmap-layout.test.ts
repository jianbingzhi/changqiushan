import * as echarts from "echarts";
import { describe, it, expect } from "vitest";

import { HEATMAP_GRID, HEATMAP_VISUAL_MAP_POS } from "./heatmap-layout";
import { SCREEN_HEATMAP_PALETTE, buildHeatmapOption } from "./heatmap-option";

// round-01 N10 防回归:色阶条压住 X 轴时间刻度。
// 这是纯几何缺陷,读源码看不出来——只有把图真画一遍、量出文字坐标才能判。
// 故用 echarts 的 SSR 模式(renderer: svg)在 node 里真渲染,再解析 <text> 的坐标做碰撞检测。

// 渲染的必须是组件真正下发的那份 option(buildHeatmapOption),不能手搓一份平行的——
// 手搓版盖不住组件里的改动,round-01 N13 就是这么溜过去的(评审建议 ②)。
const MATRIX = Array.from({ length: 7 }, (_, dow) => Array.from({ length: 24 }, (_, hour) => (hour * 7 + dow) % 63));

// 各调用点的真实画布尺寸(后台卡片 / 大屏三块 / 两个极端容器)
const CANVASES: [name: string, width: number, height: number][] = [
  ["后台 /analytics/heatmap", 1150, 340],
  ["大屏 /screen/heatmap", 1600, 620],
  ["大屏 /screen/poster", 760, 280],
  ["大屏 /screen/command", 900, 270],
  ["窄容器", 520, 300],
  ["矮容器", 900, 200],
];

interface Box {
  text: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

// 12px 字号下的保守半宽:CJK 约 6px/字、数字约 3.5px/字,再各留 3px 余量。
// 宁可估宽也不估窄——估窄会漏报重叠,这条测试就白写了。
// 两组文字之间至少要留的空白(px),见下方 tooClose
const CLEARANCE = 6;

const halfWidth = (t: string) => t.split("").reduce((w, c) => w + (/[一-龥]/.test(c) ? 6 : 3.5), 0) / 2 + 3;

function textBoxes(svg: string): Box[] {
  const boxes: Box[] = [];
  const re = /<text([^>]*)>([^<]*)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const attrs = m[1];
    const text = m[2];
    const tr = /transform="translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)"/.exec(attrs);
    const dx = parseFloat(/\sx="([-\d.e]+)"/.exec(attrs)?.[1] ?? "0") || 0;
    const dy = parseFloat(/\sy="([-\d.e]+)"/.exec(attrs)?.[1] ?? "0") || 0;
    const cx = (tr ? Number(tr[1]) : 0) + dx;
    const cy = (tr ? Number(tr[2]) : 0) + dy;
    const hw = halfWidth(text);
    boxes.push({ text, x0: cx - hw, x1: cx + hw, y0: cy - 7, y1: cy + 7 });
  }
  return boxes;
}

function renderHeatmap(width: number, height: number) {
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
  chart.setOption({
    ...buildHeatmapOption({ matrix: MATRIX, pal: SCREEN_HEATMAP_PALETTE }),
    animation: false,
  });
  const svg = chart.renderToSVGString();
  chart.dispose();
  const boxes = textBoxes(svg);
  return {
    axis: boxes.filter((b) => /时$/.test(b.text)), // X 轴时间刻度
    visualMap: boxes.filter((b) => /^\d+$/.test(b.text)), // 色阶条两端的端点数值
  };
}

// 判据是「留白」不是「不相交」:r1 那张截图里端点数值与「10时」严格算并未相交,
// 只差几个像素,肉眼已经糊成一团。故把其中一个盒子四向各外扩 2×CLEARANCE 再判相交,挨着也算不合格。
const tooClose = (a: Box, b: Box) =>
  a.x0 < b.x1 + 2 * CLEARANCE &&
  b.x0 - 2 * CLEARANCE < a.x1 &&
  a.y0 < b.y1 + 2 * CLEARANCE &&
  b.y0 - 2 * CLEARANCE < a.y1;

describe("N10 热力图色阶条不压 X 轴刻度", () => {
  it.each(CANVASES)("%s(%i×%i):色阶条端点标签与轴刻度既不重叠也不被裁切", (_name, width, height) => {
    const { axis, visualMap } = renderHeatmap(width, height);
    expect(axis.length).toBeGreaterThan(0);
    expect(visualMap.length).toBe(2); // 端点「0」「62」都在

    const collisions = axis.flatMap((a) => visualMap.filter((v) => tooClose(a, v)).map((v) => `${a.text} × ${v.text}`));
    expect(collisions).toEqual([]);

    const clipped = [...axis, ...visualMap].filter((b) => b.x0 < 0 || b.x1 > width || b.y0 < 0 || b.y1 > height);
    expect(clipped.map((b) => b.text)).toEqual([]);
  });

  it("色阶条竖排在右侧留白里,不再横排在绘图区下方", () => {
    expect(HEATMAP_VISUAL_MAP_POS.orient).toBe("vertical");
    // 右侧留白必须容得下色阶条(条宽 20 + 端点数值),否则又会压回绘图区
    expect(HEATMAP_GRID.right).toBeGreaterThanOrEqual(HEATMAP_VISUAL_MAP_POS.right + 24);
  });
});

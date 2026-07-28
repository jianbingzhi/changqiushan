import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import { adminChartPalette } from "./charts/admin-chart-palette";

// 深色主题防回归。这一组断言全部指向 round-01 实测到的具体缺陷:
// 一处写死的浅色 hex / 一条漏掉的 color-scheme,在深色主题下就是一块刺眼的白面,
// 而这类缺陷跑 lint / tsc / 单元测试都发现不了,只能靠"守住已修好的那一行"。

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("N02 富文本编辑器走语义 token", () => {
  const src = read("./editor/RichTextEditor.tsx");

  it("工具栏 / 激活态 / 错误条不得再出现写死的 bg-[#…]", () => {
    expect(src).not.toMatch(/bg-\[#/);
  });

  it("工具栏底色走 bg-muted", () => {
    expect(src).toMatch(/border-b border-border bg-muted/);
  });
});

describe("N02 编辑页同族硬编码清零(code review r3 ①)", () => {
  // 同一张编辑页上漏掉的 `text-[#374151]` 在深色下是深字压深底,比工具栏白条更难读
  const src = read("../../app/(admin)/content/_content-form.tsx");

  it("_content-form.tsx 不得再出现写死颜色的 text-[#…] / bg-[#…] / border-[#…]", () => {
    expect(src).not.toMatch(/(?:text|bg|border)-\[#/);
  });
});

describe("N03/N05 后台图表挂载前不初始化 echarts(code review r3 ②)", () => {
  // useDarkMode 的服务端快照只能是浅色,若挂载即画,深色用户会看到一帧浅色图表
  it("Heatmap724 的 auto 变体挂载前只占位", () => {
    const src = read("./screen/charts/Heatmap724.tsx");
    expect(src).toMatch(/variant === "auto" && !mounted/);
  });

  it("行政图挂载前只占位", () => {
    const src = read("../../app/(admin)/analytics/source/_region-map.tsx");
    expect(src).toMatch(/mounted[\s\S]{0,40}<EChart/);
  });
});

describe("N04 深色主题声明 color-scheme", () => {
  const css = read("../../app/globals.css");

  it(".dark 声明 color-scheme: dark(原生 select / date 控件才跟随深色)", () => {
    const dark = css.slice(css.indexOf(".dark {"));
    expect(dark.slice(0, dark.indexOf("}"))).toMatch(/color-scheme:\s*dark/);
  });

  it(":root 声明 color-scheme: light", () => {
    const root = css.slice(css.indexOf(":root {"));
    expect(root.slice(0, root.indexOf("}"))).toMatch(/color-scheme:\s*light/);
  });
});

describe("N03/N05 后台图表配色随主题切换", () => {
  const light = adminChartPalette(false);
  const dark = adminChartPalette(true);

  it("深浅两套取色逐项不同(任何一项相同都意味着该元素在某个主题下失配)", () => {
    for (const key of Object.keys(light) as (keyof typeof light)[]) {
      expect(JSON.stringify(dark[key]), `${key} 深浅同色`).not.toBe(JSON.stringify(light[key]));
    }
  });

  it("深色色阶低值贴近深色卡片,浅色色阶低值贴近白卡", () => {
    expect(dark.heatRange[0]).toBe("#1A241E");
    expect(light.heatRange[0]).toBe("#EAF6EC");
  });

  it("行政图取色不再写死在组件里", () => {
    const src = read("../../app/(admin)/analytics/source/_region-map.tsx");
    for (const hardcoded of ["#F3F4F6", "#FFD54F", "#EAF6EC", "#6B7280"]) {
      expect(src, `_region-map.tsx 仍写死 ${hardcoded}`).not.toContain(hardcoded);
    }
    expect(src).toMatch(/adminChartPalette/);
  });

  it("后台热力图用 auto 变体跟随主题(不再钉死 light)", () => {
    const src = read("../../app/(admin)/analytics/heatmap/page.tsx");
    expect(src).toMatch(/variant="auto"/);
  });
});

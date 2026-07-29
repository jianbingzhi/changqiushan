import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

// round-01 N18 防回归 + PRD §四② 硬约束(「B 端后台与大屏文本对比度须满足 WCAG AA 4.5:1;
// 配色须由 token 统一管理并支持双主题,页面内不得写死色值」)的可执行版本。
//
// status-chip.contrast.test.ts 守的是**状态徽章**那一小片;这份守的是**基础 token 本身**——
// N18 那批(面包屑 2.43:1 / 表头 4.39:1 / 白字压主色 4.09:1 / 白字压红徽标 3.76:1)全部是
// globals.css 里长期存在的 token 值,一条组件测试都碰不到,只能在 token 这一层守。
//
// 三组判据:
//   ① 文字 token × 中性底 token —— 每一对都要 ≥ 4.5:1(取"最难的底",不挑好看的算);
//   ② 实底 token + 其白色前景 —— 按钮 / 徽标这类"白字压色块";
//   ③ 淡底(10%)上的 -strong 文字 —— 与 N16 同口径,新增的 primary 一对也纳入。
// 再加一条**用法守卫**:实底那几支(primary/danger/success/warning/info/destructive)不许再被
// 当成文字色写进组件(`text-danger` 之类),否则 ①②③ 算得再对,组件照样能绕开它们退回缺陷态。

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const CSS = readFileSync(here("../../app/globals.css"), "utf8");

/** 取 `:root { … }` / `.dark { … }` 里的 `--name: value` 表 */
function themeVars(selector: string): Record<string, string> {
  const start = CSS.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`globals.css 里找不到 ${selector}`);
  const block = CSS.slice(start, CSS.indexOf("}", start));
  const vars: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[name] = value.trim();
  return vars;
}

const THEMES = { 浅色: themeVars(":root"), 深色: themeVars(".dark") };

type Rgb = [number, number, number];

function hex(value: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(value);
  if (!m) throw new Error(`不是 6 位 hex:${value}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function over(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

// —— ① 文字 token × 中性底 token ——
// 底取全部中性面:卡片 / 页面底 / 弱化块(表头、tab 条)/ 浮层。文字任何一支落在任何一面上都要读得清,
// 「这支只用在白卡上」这种假设一旦被下一个页面打破,就是 N18 ① 原样复发。
const SURFACES = ["card", "bg", "muted", "popover", "secondary", "accent"] as const;
const TEXT_TOKENS = [
  "fg", "card-fg", "popover-fg", "secondary-fg", "accent-fg", "muted-fg",
  "text-primary", "text-secondary", "text-muted",
  "primary-strong", "success-strong", "warning-strong", "danger-strong", "info-strong", "muted-strong",
] as const;

// —— ② 实底 + 白色前景 —— 白字压色块(主按钮 / hover 态 / 破坏性按钮 / 顶栏消息徽标)
const SOLID_ON_FG: ReadonlyArray<readonly [string, string]> = [
  ["primary", "primary-fg"],
  ["primary-hover", "primary-fg"],
  ["destructive", "destructive-fg"],
  ["sidebar-active", "sidebar-text"],
  ["sidebar", "sidebar-text"],
];

// —— ③ 10% 淡底上的 -strong 文字(与 N16 同口径,底基准取 --card)——
const TINT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["primary", "primary-strong"],
  ["success", "success-strong"],
  ["warning", "warning-strong"],
  ["danger", "danger-strong"],
  ["info", "info-strong"],
];

describe("N18 ① 文字 token 在任何中性底上都过 AA 4.5:1", () => {
  const cases = Object.entries(THEMES).flatMap(([theme, vars]) =>
    TEXT_TOKENS.flatMap((fg) => SURFACES.map((bg) => [theme, fg, bg, vars] as const)),
  );

  it.each(cases)("%s · --%s 落在 --%s 上", (_theme, fg, bg, vars) => {
    expect(contrast(hex(vars[fg]), hex(vars[bg]))).toBeGreaterThanOrEqual(AA);
  });
});

describe("N18 ③④ 白字压实底同样要过 AA", () => {
  const cases = Object.entries(THEMES).flatMap(([theme, vars]) =>
    SOLID_ON_FG.map(([bg, fg]) => [theme, bg, fg, vars] as const),
  );

  it.each(cases)("%s · --%s 上的 --%s", (_theme, bg, fg, vars) => {
    expect(contrast(hex(vars[fg]), hex(vars[bg]))).toBeGreaterThanOrEqual(AA);
  });
});

describe("N16/N18 10% 淡底上的 -strong 文字", () => {
  const cases = Object.entries(THEMES).flatMap(([theme, vars]) =>
    TINT_PAIRS.map(([tint, fg]) => [theme, tint, fg, vars] as const),
  );

  it.each(cases)("%s · --%s-strong 落在 --%s/10 上", (_theme, tint, fg, vars) => {
    const bg = over(hex(vars[tint]), 0.1, hex(vars.card));
    expect(contrast(hex(vars[fg]), bg)).toBeGreaterThanOrEqual(AA);
  });
});

// —— 自证:缺陷版的那几个实测值必须真的不达标,否则上面全绿也说明不了什么 ——
describe("自证:N18 报的四个数用同一套算法必须复现", () => {
  it("① 面包屑 #9CA3AF 落在 #F9FAFB 上 ≈ 2.43:1", () => {
    expect(contrast(hex("#9CA3AF"), hex("#F9FAFB"))).toBeCloseTo(2.43, 1);
  });
  it("② 表头 #6B7280 落在 #F3F4F6 上 ≈ 4.39:1", () => {
    expect(contrast(hex("#6B7280"), hex("#F3F4F6"))).toBeCloseTo(4.39, 1);
  });
  it("③ 白字压深色主色 #4C8C43 ≈ 4.09:1", () => {
    expect(contrast(hex("#FFFFFF"), hex("#4C8C43"))).toBeCloseTo(4.09, 1);
  });
  it("④ 白字压 #EF4444 ≈ 3.76:1", () => {
    expect(contrast(hex("#FFFFFF"), hex("#EF4444"))).toBeCloseTo(3.76, 1);
  });
});

// —— 用法守卫:实底那几支不许再当文字色用 ——
// 判据落在源码上而不是色值上:token 表算得再对,只要组件写回 `text-danger`,深色卡片上就还是 4.44:1。
const SOLID_ONLY = ["primary", "success", "warning", "danger", "info", "destructive"] as const;

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) tsxFiles(full, acc);
    else if (entry.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

describe("PRD §四② 组件层:实底 token 不得当文字色,写死色值不得复活", () => {
  // 大屏(screen)是 always-dark 独立作用域、另有 --screen-* 一套,不在本表口径内
  const files = tsxFiles(here("../../app")).concat(tsxFiles(here(".")))
    .filter((f) => !f.includes("/app/screen/") && !f.includes("/ui/screen/"));

  it("扫到的组件文件数量合理(扫不到文件 = 下面两条形同虚设)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(SOLID_ONLY)("没有组件再用 text-%s(应改用 -strong 那一档)", (token) => {
    const pattern = new RegExp(`(?<![\\w-])text-${token}(?![\\w-])`);
    const offenders = files.filter((f) => pattern.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.slice(f.indexOf("/src/")))).toEqual([]);
  });

  it("没有组件再写死 hex 色值(bg-[#…] / text-[#…] / border-[#…])", () => {
    const offenders = files.filter((f) => /(?:text|bg|border|ring|fill|stroke)-\[#/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.slice(f.indexOf("/src/")))).toEqual([]);
  });
});

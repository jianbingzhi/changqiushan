import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

// round-01 N16 防回归。这条守卫盯两件事,缺一条徽章就会退回缺陷态:
//   ① 徽章不得再写死 hex —— 写死 = 不跟随主题,深色卡片上是一颗颗亮片(21 个条目、15 种硬编码色、13 个页面在用);
//   ② 每个色调在**深浅两套主题**下都要过 WCAG AA 4.5:1 —— 旧版实测 开放 3.15:1 / 已满 4.41:1,12px 小字更吃对比度。
//
// 判据直接从组件的 TONE_CLASS 里读类名、再回 globals.css 取实值算,不另抄一份色表:
// 抄一份就会漂,改了组件而测试还绿正是这类缺陷能活下来的原因。

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const CHIP_SRC = read("./status-chip.tsx");
const CSS = read("../../app/globals.css");

/** 取 `:root { … }` / `.dark { … }` 里的 `--name: value` 表 */
function themeVars(selector: string): Record<string, string> {
  const start = CSS.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`globals.css 里找不到 ${selector}`);
  const block = CSS.slice(start, CSS.indexOf("}", start));
  const vars: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[name] = value.trim();
  return vars;
}

const THEMES = {
  浅色: themeVars(":root"),
  深色: themeVars(".dark"),
};

type Rgb = [number, number, number];

function hex(value: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(value);
  if (!m) throw new Error(`不是 6 位 hex:${value}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 半透明前景压在不透明背景上的实际观感色 */
function over(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as Rgb;
}

/** WCAG 相对亮度 */
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

/** `bg-success/10` → { token: "success", alpha: 0.1 };`bg-muted` → { token: "muted", alpha: 1 } */
function parseUtility(prefix: string, classes: string): { token: string; alpha: number } {
  const m = new RegExp(`${prefix}-([\\w-]+?)(?:/(\\d+))?(?:\\s|$)`).exec(`${classes} `);
  if (!m) throw new Error(`TONE_CLASS 里没有 ${prefix}-*:${classes}`);
  return { token: m[1], alpha: m[2] ? Number(m[2]) / 100 : 1 };
}

/** 从组件源码里读回真正在用的类名,而不是在测试里另抄一份 */
function toneClasses(): Record<string, string> {
  const start = CHIP_SRC.indexOf("const TONE_CLASS");
  const block = CHIP_SRC.slice(start, CHIP_SRC.indexOf("};", start));
  const tones: Record<string, string> = {};
  for (const [, tone, cls] of block.matchAll(/(\w+):\s*"([^"]+)"/g)) tones[tone] = cls;
  return tones;
}

const TONES = toneClasses();

describe("N16 状态徽章不再写死颜色", () => {
  it("status-chip.tsx 里不得出现任何 hex 色值", () => {
    expect(CHIP_SRC).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });

  it("也不得走 Tailwind 任意值(bg-[#…] / text-[#…] / border-[#…])", () => {
    expect(CHIP_SRC).not.toMatch(/(?:text|bg|border)-\[/);
  });

  it("不得再用内联 style 上色(内联色同样不跟随主题)", () => {
    expect(CHIP_SRC).not.toMatch(/style=\{\{/);
  });

  it("5 个语义色调全部读到了(读不到就等于下面的对比度用例全被跳过)", () => {
    expect(Object.keys(TONES).sort()).toEqual(["danger", "info", "neutral", "success", "warning"]);
  });
});

describe("N16 徽章文字在深浅两主题下都达 WCAG AA 4.5:1", () => {
  // 徽章主要落在卡片(表格行 / 面板卡)上,取 --card 作背景基准
  const cases = Object.entries(TONES).flatMap(([tone, classes]) =>
    Object.entries(THEMES).map(([themeName, vars]) => [themeName, tone, classes, vars] as const),
  );

  it.each(cases)("%s · %s", (_themeName, _tone, classes, vars) => {
    const card = hex(vars.card);
    const bgUtil = parseUtility("bg", classes);
    const fgUtil = parseUtility("text", classes);

    const bg = over(hex(vars[bgUtil.token]), bgUtil.alpha, card);
    const fg = hex(vars[fgUtil.token]);

    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  // 自证:退回缺陷版的取值(实底色直接当文字色)必须转红,否则这条守卫拦不住 N16 重演
  it("自证:缺陷版(开放 #16A34A / #F0FDF4、已满 #DC2626 / #FEF2F2)确实不达标", () => {
    expect(contrast(hex("#16A34A"), hex("#F0FDF4"))).toBeLessThan(4.5);
    expect(contrast(hex("#DC2626"), hex("#FEF2F2"))).toBeLessThan(4.5);
  });

  // 缺陷之二:旧版深浅两主题 computed 完全一致 = 根本没跟随主题
  it("同一个色调在深浅两主题下取到的实际配色必须不同", () => {
    for (const [tone, classes] of Object.entries(TONES)) {
      const pick = (vars: Record<string, string>) => {
        const bgUtil = parseUtility("bg", classes);
        const fgUtil = parseUtility("text", classes);
        return `${vars[bgUtil.token]}@${bgUtil.alpha}/${vars[fgUtil.token]}`;
      };
      expect(pick(THEMES.浅色), `${tone} 深浅同色`).not.toBe(pick(THEMES.深色));
    }
  });
});

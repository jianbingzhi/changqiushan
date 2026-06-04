#!/usr/bin/env node
// C 端小程序中文红线扫描:JSX 文本禁止 PRD 红线词 + ISO 日期 + Lorem
// 扫 src 下全部 .tsx(UI 层);跳过 TS 代码行,只查 JSX 文本。CI 与提审前执行。

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const RED_LIST = [
  /门票/,
  /票价/,
  /购票/,
  /退款/,
  /售票/,
  /票务/,
  /Lorem/i,
  /\d{4}-\d{2}-\d{2}/, // ISO 日期(展示应用「2026年6月15日」)
];

const SKIP_PATTERNS = [
  /^\s*(export|import|const|let|var|function|class|type|interface|enum|return\s+\(|async|await)\b/,
  /^\s*\/\//,
  /^\s*\*/,
  /^\s*\{/,
  /^\s*\}/,
  /\/@ts-/,
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (extname(full) === ".tsx") out.push(full);
  }
  return out;
}

const srcDir = new URL("../src", import.meta.url).pathname;
const files = walk(srcDir);
let errors = 0;

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (SKIP_PATTERNS.some((p) => p.test(line))) return;
    for (const pattern of RED_LIST) {
      if (pattern.test(line)) {
        const rel = file.replace(process.cwd() + "/", "");
        console.error(`[lint:cn] ${rel}:${i + 1} → ${pattern} → ${line.trim()}`);
        errors++;
      }
    }
  });
}

if (errors > 0) {
  console.error(`[lint:cn] ✖ 命中 ${errors} 处红线`);
  process.exit(1);
}
console.log("[lint:cn] ✔ 无红线违规");

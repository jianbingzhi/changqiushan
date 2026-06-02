#!/usr/bin/env node
// 中文红线扫描: JSX 文本内容禁止出现 PRD 红线词 + ISO 日期格式 + Lorem
// 只扫 src/app/ 下的 TSX 文件(UI 层);跳过 TypeScript 代码行,只查 JSX 文本

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const RED_LIST = [
  /门票/,
  /票价/,
  /购票/,
  /退款/,
  /票务/,
  /Lorem/i,
  /\d{4}-\d{2}-\d{2}/,   // ISO 日期 YYYY-MM-DD
];

// 跳过 TypeScript 代码行:函数声明/变量/导入/注释等不属于 UI 文本
const SKIP_PATTERNS = [
  /^\s*(export|import|const|let|var|function|class|type|interface|enum|return\s+\(|async|await)\b/,
  /^\s*\/\//,
  /^\s*\*/,
  /^\s*\{/,         // 纯 JS 表达式行
  /^\s*\}/,
  /\/@ts-/,
];

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      entries.push(...walk(full));
    } else if (extname(full) === ".tsx") {
      entries.push(full);
    }
  }
  return entries;
}

const srcDir = new URL("../src/app", import.meta.url).pathname;
const files  = walk(srcDir);
let errors   = 0;

for (const file of files) {
  const src   = readFileSync(file, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    if (SKIP_PATTERNS.some((p) => p.test(line))) return;
    for (const pattern of RED_LIST) {
      if (pattern.test(line)) {
        const relPath = file.replace(process.cwd() + "/", "");
        console.error(`[lint:cn] ${relPath}:${i + 1} → ${pattern} → ${line.trim()}`);
        errors++;
      }
    }
  });
}

if (errors > 0) {
  console.error(`\n[lint:cn] ✖ ${errors} 个红线违规`);
  process.exit(1);
} else {
  console.log("[lint:cn] ✔ 无红线违规");
}

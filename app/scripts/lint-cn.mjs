#!/usr/bin/env node
// 中文红线扫描: JSX 文本内容禁止出现 PRD 红线词 + ISO 日期格式 + Lorem
// 另含 X.2 设计系统英文断言:JSX 可见文本里不得有孤立英文词(启发式正则 + 白名单)
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
  /^\s*["'`]use (client|server)["'`];?\s*$/, // "use client"/"use server" 指令
  /^\s*\/\//,
  /^\s*\*/,
  /^\s*\{/,         // 纯 JS 表达式行
  /^\s*\}/,
  /\/@ts-/,
];

// X.2 英文断言白名单(大写比对):品牌名/技术缩写/计量单位等在中文 UI 中合法的 ASCII token。
// 词表是辅助;主力是「snake_case 技术标识符(含下划线)整体豁免」+「标签/表达式遮罩」。
const ASCII_ALLOW = new Set([
  // 技术缩写 / 渠道
  "SSE", "OTA", "APP", "API", "URL", "ID", "IP", "QR", "GPS", "IOT", "NFC", "RFID",
  "AI", "VR", "AR", "SDK", "CPU", "GPU", "OK", "WIFI", "HTTP", "HTTPS", "JWT", "RBAC",
  // 品牌 / 产品
  "EXCEL", "PDF", "CSV", "MINIO", "COS", "OSS", "AMAP", "GOTRUE", "POSTGRES", "NOTIFY",
  // 计量单位
  "KM", "KG", "MG", "PM", "AQI", "CO", "NO", "SO", "UV", "HPA", "DB", "MS", "CM", "MM",
]);

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

// 抽 JSX 可见文本节点:同一行内 `>文本<` 之间的内容(排除标签 <…> 与表达式 {…})。
// 前置 (?<!=) 排除箭头 `=>`,避免把 `=> Promise<T>` 这类类型/代码误当文本。
const TEXT_NODE_RE = /(?<!=)>([^<>{}]*)</g;

const srcDir = new URL("../src/app", import.meta.url).pathname;
const files  = walk(srcDir);
let errors   = 0;

for (const file of files) {
  const src      = readFileSync(file, "utf8");
  const lines    = src.split("\n");
  const relPath  = file.replace(process.cwd() + "/", "");

  lines.forEach((line, i) => {
    if (SKIP_PATTERNS.some((p) => p.test(line))) return;

    // ① PRD 红线词 / ISO 日期(整行扫,词不出现在属性名里)
    for (const pattern of RED_LIST) {
      if (pattern.test(line)) {
        console.error(`[lint:cn] ${relPath}:${i + 1} → ${pattern} → ${line.trim()}`);
        errors++;
      }
    }

    // ② 孤立英文词:只在 JSX 可见文本节点里扫
    let m;
    TEXT_NODE_RE.lastIndex = 0;
    while ((m = TEXT_NODE_RE.exec(line))) {
      for (const wsToken of m[1].split(/\s+/)) {
        if (!wsToken || wsToken.includes("_")) continue; // snake_case 技术标识符整体豁免
        const words = wsToken.match(/[A-Za-z]{2,}/g);
        if (!words) continue;
        for (const w of words) {
          if (!ASCII_ALLOW.has(w.toUpperCase())) {
            console.error(`[lint:cn] ${relPath}:${i + 1} → 孤立英文「${w}」→ ${line.trim()}`);
            errors++;
          }
        }
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

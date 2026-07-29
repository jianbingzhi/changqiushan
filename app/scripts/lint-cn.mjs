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
  // 数字大屏:GIS / 数据可视化领域缩写
  "POI", "KPI", "GIS",
  // C6 导览图中英对照标题「导览图 / Tour Map」—— PRD 明确允许的唯一英文例外
  "TOUR", "MAP",
  // 品牌 / 产品
  "EXCEL", "PDF", "CSV", "MINIO", "COS", "OSS", "AMAP", "GOTRUE", "POSTGRES", "NOTIFY",
  // 图片 / 文件格式
  "JPG", "JPEG", "PNG", "WEBP", "GIF",
  // 计量单位
  "KM", "KG", "MG", "PM", "AQI", "CO", "NO", "SO", "UV", "HPA", "DB", "MS", "CM", "MM", "KB", "MB", "GB",
  // 示例编码前缀(占位符里的工号样例 如 OPS-001)
  "OPS",
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

// SSE 频道名是技术标识符(含下划线,会被 snake_case 豁免漏掉),UI 文本里不得出现(C7 红线 6)。
const CHANNEL_NAME_RE = /\b(checkin_event|slot_changed|parking_state|iot_event)\b/;

// 抽 JSX 可见文本节点:同一行内 `>文本<` 之间的内容(排除标签 <…> 与表达式 {…})。
// 前置 (?<![=<>!]) 排除箭头 `=>` 与比较符 `<=`/`>=`/`>>`/`!=`;后置 (?!=) 排除 `>=` 自身。
// 否则 `if (r.dow >= 0 && r.dow < 7)` 这类纯 TS 比较会被当成 JSX 文本节点误报孤立英文。
const TEXT_NODE_RE = /(?<![=<>!])>(?!=)([^<>{}]*)</g;
// 用户可见的属性值(同样是 UI 文本,英文不得孤立出现);只取字面量 "…"
const VISIBLE_ATTR_RE = /(?:placeholder|title|aria-label|alt)\s*=\s*"([^"]*)"/g;

const srcDir = new URL("../src/app", import.meta.url).pathname;

// ── 时区红线(P10):禁止用当前时刻派生「业务日历日」。
//   `new Date().toISOString()` 恒按 UTC 取日,北京 0–8 点偏到昨天 → 一律走
//   `@/shared/lib/time` 的 chinaToday()/toCstDateStr()。扫全 src(.ts/.tsx),
//   仅 time.ts 自身豁免。注:domain rules 里 `slot.date.toISOString()`(从 @db.Date
//   列取日)与 `+08:00`(钉北京墙钟)是正确用法,不在本规则范围。
const TZ_BAD_RE = /new\s+Date\(\s*\)\s*\.toISOString\s*\(\s*\)\s*\.slice/;
const TZ_EXEMPT = /shared\/lib\/time\.ts$/;

function walkSrc(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) entries.push(...walkSrc(full));
    else if (extname(full) === ".ts" || extname(full) === ".tsx") entries.push(full);
  }
  return entries;
}

function lintTimezone() {
  const root = new URL("../src", import.meta.url).pathname;
  let n = 0;
  for (const file of walkSrc(root)) {
    if (TZ_EXEMPT.test(file)) continue;
    const relPath = file.replace(process.cwd() + "/", "");
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return; // 跳过注释
      if (TZ_BAD_RE.test(line)) {
        console.error(`[lint:cn] ${relPath}:${i + 1} → 时区红线 new Date().toISOString() 取业务日,请改用 @/shared/lib/time → ${line.trim()}`);
        n++;
      }
    });
  }
  return n;
}

// 在一段可见文本里挑出未豁免的孤立英文词并报错
function flagAsciiWords(segment, relPath, lineNo, line) {
  let n = 0;
  for (const wsToken of segment.split(/\s+/)) {
    if (!wsToken || wsToken.includes("_")) continue; // snake_case 技术标识符整体豁免
    const words = wsToken.match(/[A-Za-z]{2,}/g);
    if (!words) continue;
    for (const w of words) {
      if (!ASCII_ALLOW.has(w.toUpperCase())) {
        console.error(`[lint:cn] ${relPath}:${lineNo} → 孤立英文「${w}」→ ${line.trim()}`);
        n++;
      }
    }
  }
  return n;
}
const files  = walk(srcDir);
let errors   = lintTimezone();

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

    // ② 孤立英文词:JSX 可见文本节点 + 用户可见属性值(placeholder/title/aria-label/alt)
    let m;
    TEXT_NODE_RE.lastIndex = 0;
    while ((m = TEXT_NODE_RE.exec(line))) {
      errors += flagAsciiWords(m[1], relPath, i + 1, line);
      if (CHANNEL_NAME_RE.test(m[1])) {
        console.error(`[lint:cn] ${relPath}:${i + 1} → UI 露出 SSE 频道名(技术标识) → ${line.trim()}`);
        errors++;
      }
    }
    VISIBLE_ATTR_RE.lastIndex = 0;
    while ((m = VISIBLE_ATTR_RE.exec(line))) {
      errors += flagAsciiWords(m[1], relPath, i + 1, line);
    }
  });
}

if (errors > 0) {
  console.error(`\n[lint:cn] ✖ ${errors} 个红线违规`);
  process.exit(1);
} else {
  console.log("[lint:cn] ✔ 无红线违规");
}

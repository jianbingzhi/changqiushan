import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// round-01 N21 防回归:docker-compose 的 `app.environment` 是**显式白名单**——
// compose 的 .env 只用于插值 YAML 里写出来的 ${VAR},不会把 .env 的每个 key 自动注进容器。
// 漏一行,运维写进服务器 .env 的值就永远到不了 app 进程,代码静默拿 undefined 走缺省。
//
// 实测代价:GATE_API_KEY 漏了 ⇒ /api/gate/checkin 恒 401(闸机核销在 docker 路径下从未可用过)、
// CRON_SECRET 漏了 ⇒ /api/cron/refresh-mv 恒 500。症状是 401/500,排查会被引向鉴权和代码,
// 没人会想到是 compose 少了一行 —— 这正是「肉眼 review 拦不住、必须机器卡住」的那类缺口。
//
// 所以这条守卫直接比对两个集合:**代码里所有 process.env.X 读取 ⊆ compose 白名单 ∪ 豁免**。
// 豁免只有「运行时自带」和「构建期内联」两类,每一条都要写清理由;不允许往豁免里塞「这个先不管」。

const APP_DIR = join(import.meta.dirname, "../../..");

/** 运行时自己注入 / 构建期内联,不该也不能从 compose 白名单透传 */
const EXEMPT = new Map<string, string>([
  ["NODE_ENV", "compose 已显式设为 production(在白名单里,这里只是说明它不走 ${} 插值)"],
  ["TZ", "同上,compose 已显式设为 Asia/Shanghai"],
  ["NEXT_RUNTIME", "Next 自己按 edge/nodejs 注入"],
  ["VERCEL", "Vercel 平台注入;docker 路径下恒 undefined 即为正确语义"],
]);

/** NEXT_PUBLIC_* 是构建期内联进产物的,靠 build args 传(见 compose 的 build.args),不是运行期 env */
const isBuildTimeInlined = (key: string) => key.startsWith("NEXT_PUBLIC_");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mts|cts)$/.test(name)) out.push(p);
  }
  return out;
}

// 全仓源文件只扫一次(两条用例共用);守卫自己这个文件里的示例名不算「读取」
const SOURCES = [...walk(join(APP_DIR, "src")), ...walk(join(APP_DIR, "scripts"))]
  .filter((f) => !f.endsWith("compose-env.test.ts"))
  .map((f) => ({ rel: f.slice(APP_DIR.length + 1), text: readFileSync(f, "utf8") }));

/** 代码里读到的所有 env 名 */
function envKeysReadByCode(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const { rel: file, text: src } of SOURCES) {
    for (const m of src.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      const list = found.get(m[1]) ?? [];
      list.push(file);
      found.set(m[1], list);
    }
  }
  return found;
}

/** compose 里 app 服务 environment 块列出的键(块级缩进解析,不引 yaml 依赖) */
function composeAppEnvKeys(): { keys: Set<string>; lines: string[] } {
  const yml = readFileSync(join(APP_DIR, "docker-compose.yml"), "utf8").split("\n");
  const start = yml.findIndex((l) => /^ {4}environment:\s*$/.test(l)); // 4 空格 = app 服务下的块
  expect(start, "docker-compose.yml 里找不到 app 服务的 environment 块").toBeGreaterThan(-1);
  const keys = new Set<string>();
  const lines: string[] = [];
  for (const line of yml.slice(start + 1)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (!/^ {6}\S/.test(line)) break; // 缩进退出 6 空格 = 出块
    const m = /^ {6}([A-Za-z0-9_]+):/.exec(line);
    if (!m) break;
    keys.add(m[1]);
    lines.push(line);
  }
  return { keys, lines };
}

describe("N21 compose 的 env 白名单必须覆盖代码读到的每一个 env", () => {
  it("代码里 process.env.X 的 X 都在 app.environment 里(否则容器里恒 undefined)", () => {
    const read = envKeysReadByCode();
    const { keys } = composeAppEnvKeys();
    const missing = [...read]
      .filter(([k]) => !keys.has(k) && !EXEMPT.has(k) && !isBuildTimeInlined(k))
      .map(([k, files]) => `${k}(读取于 ${[...new Set(files)].slice(0, 3).join("、")})`);
    expect(
      missing,
      "这些 env 代码会读、compose 却没透传 ⇒ 写进服务器 .env 也到不了容器。补进 app.environment,写法 `KEY: ${KEY:-}`",
    ).toEqual([]);
  });

  it("白名单一律用 ${KEY:-} 透传,不把值写死在 compose 里", () => {
    // 例外:容器内网地址/固定常量(DATABASE_URL、GOTRUE_URL 等)本就该由 compose 定死,不从 .env 取
    const FIXED = new Set([
      "NODE_ENV",
      "TZ",
      "DATABASE_URL",
      "GOTRUE_URL",
      "GOTRUE_JWT_ISSUER",
      "GOTRUE_JWT_EXP",
      "S3_FORCE_PATH_STYLE",
    ]);
    const { lines } = composeAppEnvKeys();
    const bad = lines
      .map((l) => l.trim())
      .filter((l) => {
        const key = l.slice(0, l.indexOf(":"));
        return !FIXED.has(key) && !/\$\{[A-Z0-9_]+(:-[^}]*)?\}/.test(l);
      });
    expect(bad, "这些行没走 ${VAR} 插值,运维改 .env 不生效").toEqual([]);
  });

  it("N21 的 4 个高危键在位(2 个 fail-closed + 2 个静默降级)", () => {
    // 单独点名:这 4 条的后果最重,合并时被误删要立刻转红,不能只靠上面那条集合比对
    const { keys } = composeAppEnvKeys();
    for (const k of ["GATE_API_KEY", "CRON_SECRET", "SCREEN_TOKEN", "PARK_INSTANT_CAPACITY"]) {
      expect(keys.has(k), `${k} 从白名单里掉了`).toBe(true);
    }
  });

  it("凡 `${KEY:-}` 透传(缺省空串)的键,读取方不得用 `??` 兜底", () => {
    // 空串 ≠ undefined:`process.env.X ?? "缺省"` 在容器里会拿到空串、把缺省顶掉,
    // 比「没透传」更隐蔽 —— LOG_LEVEL 空串会让 pino 直接抛未知 level、进程起不来。
    const { lines } = composeAppEnvKeys();
    const emptyDefaulted = lines
      .map((l) => /^\s*([A-Z0-9_]+):\s*\$\{[A-Z0-9_]+:-\}\s*$/.exec(l)?.[1])
      .filter((k): k is string => Boolean(k));
    expect(emptyDefaulted.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const { rel, text } of SOURCES) {
      for (const key of emptyDefaulted) {
        // 只揪 `?? <非空字面量>`;`?? ""` 与空串等价,无害
        const re = new RegExp(`process\\.env\\.${key}\\s*\\?\\?\\s*(?!"")\\S`);
        if (re.test(text)) offenders.push(`${key} @ ${rel}`);
      }
    }
    expect(offenders, "改用 `||`,让空串与未配置等价").toEqual([]);
  });
});

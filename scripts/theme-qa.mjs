// T3 theme 深浅截图矩阵:CDP 驱动 headless chromium,逐路由 light/dark 双截图。
// 运行:NODE_PATH=/home/agent/projects/Panda/Changqiushan/scripts/node_modules node /tmp/theme-qa.mjs
import WebSocket from "ws";
import { mkdirSync, writeFileSync } from "fs";

const APP = "http://localhost:3000";
const CDP = "http://127.0.0.1:9223";
const OUT = "/home/agent/projects/Panda/Changqiushan/UI/素材/theme-qa";
mkdirSync(OUT, { recursive: true });

const ADMIN_ROUTES = [
  "/", "/login",
  "/analytics/heatmap", "/analytics/profile", "/analytics/source", "/analytics/traffic",
  "/booking/bookings", "/booking/channels", "/booking/onsite", "/booking/quota-rules", "/booking/slots",
  "/content/activities", "/content/activities/new", "/content/assets",
  "/content/intro", "/content/intro/new", "/content/knowledge", "/content/knowledge/new",
  "/content/news", "/content/news/new",
  "/iot/devices", "/riskcontrol/blacklist", "/system",
  "/traffic/parking", "/traffic/road",
];
// 动态路由由环境变量注入(收尾脚本拼好)
const EXTRA = (process.env.EXTRA_ROUTES || "").split(",").filter(Boolean);
const SCREEN_ROUTES = ["/screen", "/screen/situation", "/screen/overview", "/screen/heatmap", "/screen/trend", "/screen/operation", "/screen/twin", "/screen/poster"];

let msgId = 0;
const pending = new Map();
let ws;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const events = [];
function waitEvent(method, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);
    const handler = (m) => { if (m.method === method) { cleanup(); resolve(m); } };
    function cleanup() { clearTimeout(t); const i = events.indexOf(handler); if (i >= 0) events.splice(i, 1); }
    events.push(handler);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nav(url) {
  const loaded = waitEvent("Page.loadEventFired");
  await send("Page.navigate", { url });
  await loaded;
  await sleep(1500); // RSC 流式/echarts/字体 settle
}

async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
  console.log("✓", name);
}

async function setTheme(theme) {
  await send("Runtime.evaluate", { expression: `localStorage.setItem('cqs-theme','${theme}')` });
}

async function main() {
  // 1) 取 GoTrue 会话 → 注 cookie
  const tok = await (await fetch("http://127.0.0.1:9999/token?grant_type=password", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "13900000000", password: "Admin@12345" }),
  })).json();
  if (!tok.access_token) throw new Error("登录失败: " + JSON.stringify(tok).slice(0, 200));

  // 2) 连 CDP
  const targets = await (await fetch(`${CDP}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 });
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    } else if (m.method) {
      for (const h of [...events]) h(m);
    }
  });
  await new Promise((r) => ws.on("open", r));
  await send("Page.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });

  for (const c of [
    { name: "sb-access-token", value: tok.access_token },
    { name: "sb-refresh-token", value: tok.refresh_token },
  ]) {
    await send("Network.setCookie", { ...c, url: APP, path: "/" });
  }

  const slug = (r) => (r === "/" ? "dashboard" : r.replace(/^\//, "").replaceAll("/", "_").replaceAll("[", "").replaceAll("]", ""));

  // 3) 后台路由 × 双主题
  await nav(`${APP}/login`); // 先上原点,localStorage 可写
  for (const theme of ["light", "dark"]) {
    await setTheme(theme);
    for (const r of [...ADMIN_ROUTES, ...EXTRA]) {
      try {
        await nav(`${APP}${r}`);
        await shot(`${slug(r)}-${theme}`);
      } catch (e) {
        console.log("✗", r, theme, e.message);
      }
    }
  }

  // 4) 大屏(always-dark,单次) + 串台检查:深色大屏看完回浅色后台
  await setTheme("light");
  for (const r of SCREEN_ROUTES) {
    try {
      await nav(`${APP}${r}`);
      await sleep(1000);
      await shot(`${slug(r)}-screen`);
    } catch (e) {
      console.log("✗", r, e.message);
    }
  }
  await nav(`${APP}/`);
  await shot("dashboard-after-screen-light"); // 串台对照:应仍是浅色

  ws.close();
  console.log("DONE");
}

main().catch((e) => { console.error(e); process.exit(1); });

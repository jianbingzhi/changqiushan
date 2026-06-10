// T1 高德 JS 层实测(dev:3001 + 真 key):road/parking/screen-twin 真地图截图。
import WebSocket from "ws";
import { mkdirSync, writeFileSync } from "fs";

const APP = "http://localhost:3001";
const OUT = "/home/agent/projects/Panda/Changqiushan/UI/素材/theme-qa";
mkdirSync(OUT, { recursive: true });

let msgId = 0;
const pending = new Map();
const events = [];
let ws;
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++msgId; pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});
const waitEvent = (method, t = 20000) => new Promise((res) => {
  const timer = setTimeout(() => res(null), t);
  events.push((m) => { if (m.method === method) { clearTimeout(timer); res(m); } });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nav(url, settle = 6000) {
  const loaded = waitEvent("Page.loadEventFired");
  await send("Page.navigate", { url });
  await loaded;
  await sleep(settle); // 地图瓦片加载需要时间
}
async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
  console.log("✓", name);
}

const tok = await (await fetch("http://127.0.0.1:9999/token?grant_type=password", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: "13900000000", password: "Admin@12345" }),
})).json();

const targets = await (await fetch("http://127.0.0.1:9224/json")).json();
ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
ws.on("message", (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  else if (m.method) for (const h of [...events]) h(m);
});
await new Promise((r) => ws.on("open", r));
await send("Page.enable");
await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });
for (const c of [["sb-access-token", tok.access_token], ["sb-refresh-token", tok.refresh_token]])
  await send("Network.setCookie", { name: c[0], value: c[1], url: APP, path: "/" });

await nav(`${APP}/traffic/road`, 9000);
await shot("LIVE-road-amap");
await nav(`${APP}/traffic/parking`, 8000);
await shot("LIVE-parking-amap");
await nav(`${APP}/screen/twin`, 9000);
await shot("LIVE-screen-twin-amap");
ws.close();
console.log("DONE");

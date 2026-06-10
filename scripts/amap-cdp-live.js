// 高德真实渲染验收:经 CDP 驱动用户侧真 Chrome(10.7.0.2:9222),
// 开新标签访问服务器 dev(10.7.0.1:3001),注 cookie → 三页截图。
process.env.CDP_HOST = "10.7.0.2:9222";
const cdp = require("/home/agent/.claude/skills/cdp/lib/cdp");
const APP = "http://10.7.0.1:3001";
const OUT = "/home/agent/projects/Panda/Changqiushan/UI/素材/theme-qa";

(async () => {
  const env = await cdp.checkEnv();
  console.log("CDP OK:", env.Browser || JSON.stringify(env).slice(0, 60));

  // 新开标签,不打扰用户现有页面
  const created = await fetch(`http://10.7.0.2:9222/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" }).then((r) => r.json());
  const conn = await cdp.connect(created.id);

  // 注入会话 cookie(GoTrue 直发)
  const tok = await (await fetch("http://127.0.0.1:9999/token?grant_type=password", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "13900000000", password: "Admin@12345" }),
  })).json();
  await conn.send("Network.enable", {});
  for (const [name, value] of [["sb-access-token", tok.access_token], ["sb-refresh-token", tok.refresh_token]]) {
    await conn.send("Network.setCookie", { name, value, url: APP, path: "/" });
  }

  const pages = [
    ["/traffic/road", "CDP-road", 9000],
    ["/traffic/parking", "CDP-parking", 8000],
    ["/screen/twin", "CDP-screen-twin", 9000],
  ];
  for (const [route, name, settle] of pages) {
    await cdp.navigate(conn, `${APP}${route}`);
    await cdp.waitForLoad(conn, 30000).catch(() => {});
    await cdp.sleep(settle);
    const probe = await cdp.evaluate(conn,
      `JSON.stringify({amap: typeof window.AMap, canvases: document.querySelectorAll("canvas").length, loadingText: document.body.innerText.includes("地图加载中")})`);
    console.log(route, "→", probe);
    const r = await cdp.screenshot(conn, `${OUT}/${name}.jpg`, { forHuman: true });
    console.log("  ✓", r.path, r.bytes, "bytes");
  }

  // 收尾:关掉我们开的标签
  await fetch(`http://10.7.0.2:9222/json/close/${created.id}`).catch(() => {});
  conn.close();
  console.log("DONE");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });

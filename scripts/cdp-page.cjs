// 单页 CDP 测试器(驱动用户浏览器):登录(cookie)→ 导航 → 截图 → 数据校验 → 控制台抓错
// 用法: NODE_PATH=./node_modules node cdp-page.cjs <token> <path> <name> <needle1|needle2|...>
const cdp = require("/home/agent/.claude/skills/cdp/lib/cdp");
const BASE = "http://10.7.0.1:3000";
const [TOKEN, PATH, NAME, NEEDLES_RAW] = process.argv.slice(2);
const NEEDLES = (NEEDLES_RAW || "").split("|").filter(Boolean);

(async () => {
  const pages = await cdp.listTargets({ type: "page" });
  const conn = await cdp.connect(pages[0].id);
  const errs = [];
  await conn.send("Runtime.enable", {});
  await conn.send("Network.enable", {});
  await conn.send("Log.enable", {}).catch(() => {});
  conn.raw.on("message", (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.method === "Runtime.exceptionThrown") errs.push("EXC " + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "").slice(0, 140));
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") { const t = (m.params.args || []).map(a => a.value || a.description || "").join(" "); if (!/webpack-hmr/.test(t)) errs.push("console.error " + t.slice(0, 140)); }
      if (m.method === "Log.entryAdded" && m.params.entry.level === "error" && !/webpack-hmr/.test(m.params.entry.text)) errs.push("LOG " + (m.params.entry.text || "").slice(0, 140));
    } catch {}
  });

  // 登录:注入 cookie(B2 表单登录在 CDP 下不跳转,先用此法继续)
  await conn.send("Network.setCookie", { name: "sb-access-token", value: TOKEN, domain: "10.7.0.1", path: "/", httpOnly: true, sameSite: "Lax" });

  await cdp.navigate(conn, BASE + PATH);
  await cdp.waitForLoad(conn);
  await cdp.sleep(2200); // 等 client island / 数据
  const title = await cdp.evaluate(conn, "document.title");
  const path = await cdp.evaluate(conn, "location.pathname");
  const bodyLen = await cdp.evaluate(conn, "document.body.innerText.length");
  const shot = await cdp.screenshot(conn, `/tmp/shot-${NAME}.jpg`, { forHuman: true });

  console.log(`页面: ${PATH}  →  落地 ${path}`);
  console.log(`标题: ${title}`);
  console.log(`正文字数: ${bodyLen} | 截图: /tmp/shot-${NAME}.jpg (${Math.round(shot.bytes / 1024)}KB)`);
  for (const n of NEEDLES) {
    const has = await cdp.evaluate(conn, `document.body.innerText.includes(${JSON.stringify(n)})`);
    console.log(`  数据校验「${n}」: ${has ? "✓ 出现" : "✘ 缺失"}`);
  }
  console.log(`控制台异常(已滤 HMR): ${errs.length ? "\n   - " + errs.slice(0, 8).join("\n   - ") : "无"}`);
  conn.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e && e.message); process.exit(1); });

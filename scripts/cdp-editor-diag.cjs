// 定位:富文本编辑器在你的 Chrome 上是否挂载(更长等待 + 抓控制台异常)
const cdp = require("/home/agent/.claude/skills/cdp/lib/cdp");
const BASE = "http://10.7.0.1:3000";
(async () => {
  const pages = await cdp.listTargets({ type: "page" });
  const conn = await cdp.connect(pages[0].id);
  // 抓控制台与异常
  const errs = [];
  await conn.send("Runtime.enable", {});
  await conn.send("Log.enable", {}).catch(() => {});
  conn.raw.on("message", (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.method === "Runtime.exceptionThrown") errs.push("EXC " + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "").slice(0, 160));
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errs.push("ERR " + (m.params.args?.map(a => a.value || a.description).join(" ") || "").slice(0, 160));
      if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errs.push("LOG " + (m.params.entry.text || "").slice(0, 160));
    } catch {}
  });

  await cdp.navigate(conn, BASE + "/content/news/new");
  await cdp.waitForLoad(conn);
  for (const t of [1500, 3000, 5000, 8000]) {
    await cdp.sleep(t - (t === 1500 ? 0 : 0));
    const mounted = await cdp.evaluate(conn, `!!document.querySelector('.richtext-content[contenteditable="true"]')`);
    const toolbar = await cdp.evaluate(conn, `!!document.querySelector('[aria-label="加粗"]')`);
    const busy = await cdp.evaluate(conn, `!!document.querySelector('[aria-busy="true"]')`);
    console.log(`  +${t}ms: 编辑器contenteditable=${mounted} 工具栏=${toolbar} 仍占位(aria-busy)=${busy}`);
    if (mounted && toolbar) break;
    await cdp.sleep(0);
  }
  // 看编辑器容器实际 DOM
  const dom = await cdp.evaluate(conn, `(()=>{const el=document.querySelector('.richtext-content')?.parentElement || document.querySelector('[aria-busy]'); return el?el.outerHTML.slice(0,200):'<未找到编辑器容器>';})()`);
  console.log("  编辑器容器 DOM:", dom.replace(/\s+/g, " "));
  console.log("  控制台异常/错误:", errs.length ? errs.slice(0, 6) : "无");
  await cdp.screenshot(conn, "/tmp/shot-editor-diag.jpg", { forHuman: true });
  conn.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e && e.message); process.exit(1); });

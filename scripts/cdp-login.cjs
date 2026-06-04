// 在用户当前 tab 登录:先试真实表单(填→点登录),不跳转就 cookie 注入兜底
const cdp = require("/home/agent/.claude/skills/cdp/lib/cdp");
const BASE = "http://10.7.0.1:3000";
const TOKEN = process.argv[2];

async function main() {
  const pages = await cdp.listTargets({ type: "page" });
  const conn = await cdp.connect(pages[0].id);
  await conn.send("Network.enable", {});

  await cdp.navigate(conn, BASE + "/login");
  await cdp.waitForLoad(conn);
  await cdp.waitForSelector(conn, "#phone");

  // 真实表单登录
  let r = await cdp.getRect(conn, "#phone");
  await cdp.click(conn, r.cx, r.cy);
  await cdp.type(conn, "13900000000");
  r = await cdp.getRect(conn, "#password");
  await cdp.click(conn, r.cx, r.cy);
  await cdp.type(conn, "Admin@12345");
  const btn = await cdp.getRect(conn, "button[type=submit]").catch(() => null);
  if (btn) await cdp.click(conn, btn.cx, btn.cy);
  await cdp.sleep(3500);
  await cdp.waitForLoad(conn);
  let path = await cdp.evaluate(conn, "location.pathname");
  let mode = "表单点登录";

  if (path === "/login") {
    // 兜底:cookie 注入
    await conn.send("Network.setCookie", { name: "sb-access-token", value: TOKEN, domain: "10.7.0.1", path: "/", httpOnly: true, sameSite: "Lax" });
    await cdp.navigate(conn, BASE + "/");
    await cdp.waitForLoad(conn);
    await cdp.sleep(1200);
    path = await cdp.evaluate(conn, "location.pathname");
    mode = "cookie 注入兜底";
  }

  const title = await cdp.evaluate(conn, "document.title");
  console.log("登录方式:", mode);
  console.log("落地:", path, "| 标题:", title);
  console.log("结果:", path !== "/login" ? "✓ 已登录" : "✗ 仍在登录页");
  console.log("表单登录是否有效:", mode === "表单点登录" ? "✓ 通(B2/B15 实际可用)" : "✗ 表单点登录未跳转,靠 cookie 兜底(B2 确认)");
  conn.close();
  process.exit(0);
}
main().catch((e) => { console.error("ERR", e && e.message); process.exit(1); });

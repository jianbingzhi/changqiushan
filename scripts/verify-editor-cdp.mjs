// 浏览器内实测 TipTap 编辑器(CDP 驱动 headless Chrome)。
// 用法: node scripts/verify-editor-cdp.mjs <accessToken>
import WebSocket from "ws";
import http from "node:http";

const TOKEN = process.argv[2];
const BASE = "http://localhost:3000";
const CDP = "localhost:9222";

function httpJson(path) {
  return new Promise((res, rej) => {
    http.get(`http://${CDP}${path}`, (r) => {
      let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(JSON.parse(d)));
    }).on("error", rej);
  });
}

async function main() {
  const ver = await httpJson("/json/version");
  const ws = new WebSocket(ver.webSocketDebuggerUrl, { perMessageDeflate: false });
  let nextId = 1;
  const pending = new Map();
  const events = [];
  const exceptions = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) {
      events.push(m);
      if (m.method === "Runtime.exceptionThrown") {
        exceptions.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
      }
    }
  });
  await new Promise((r) => ws.on("open", r));
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  // 新建标签页并附着(flatten session)
  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
  const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
  const S = (method, params) => send(method, params, sessionId);
  await S("Page.enable"); await S("Runtime.enable"); await S("Network.enable");
  await S("Network.setCookie", { name: "sb-access-token", value: TOKEN, url: BASE });

  const evalJs = async (expr) => {
    const { result } = await S("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    return result?.result?.value;
  };
  const waitLoad = () => new Promise((r) => {
    const t = setInterval(() => {
      const i = events.findIndex((e) => e.method === "Page.loadEventFired");
      if (i >= 0) { clearInterval(t); r(); }
    }, 50);
    setTimeout(() => { clearInterval(t); r(); }, 8000);
  });

  let fail = 0;
  const uniqueTitle = "浏览器实测资讯_" + Math.floor(Number(process.env.STAMP || "0") % 100000);

  // 1) 打开新建资讯页
  await S("Page.navigate", { url: `${BASE}/content/news/new` });
  await waitLoad();
  await new Promise((r) => setTimeout(r, 2500)); // 等 TipTap 客户端挂载

  // 2) 编辑器挂载检查
  const mounted = await evalJs(`!!document.querySelector('.richtext-content[contenteditable="true"]')`);
  const hasToolbar = await evalJs(`!!document.querySelector('[aria-label="加粗"]') && !!document.querySelector('[aria-label="插入图片(URL)"]')`);
  console.log("① 编辑器挂载:", mounted, "| 工具栏(加粗+图片按钮):", hasToolbar);
  if (!mounted || !hasToolbar) fail++;

  // 3) 填标题:聚焦真实 input 后用 CDP 键入(真实 input 事件,React 受控可捕获)
  await evalJs(`document.querySelector('#cf-title').focus()`);
  await S("Input.insertText", { text: uniqueTitle });
  const titleVal = await evalJs(`document.querySelector('#cf-title').value`);
  console.log("   标题输入值:", titleVal);

  // 4) 聚焦编辑器并输入正文 + 加粗
  await evalJs(`document.querySelector('.richtext-content').focus()`);
  await S("Input.insertText", { text: "正文第一段。" });
  await evalJs(`document.querySelector('[aria-label="加粗"]').click()`);
  await S("Input.insertText", { text: "加粗文字" });
  await new Promise((r) => setTimeout(r, 300));
  const bodyHtml = await evalJs(`document.querySelector('.richtext-content').innerHTML`);
  const hasBold = /<strong>加粗文字<\/strong>/.test(bodyHtml) || /font-weight/.test(bodyHtml) || /<strong>/.test(bodyHtml);
  console.log("② 正文输入+加粗:", bodyHtml.slice(0, 90).replace(/\n/g, ""), "| 含<strong>:", hasBold);
  if (!/正文第一段/.test(bodyHtml) || !hasBold) fail++;

  // 5) 点击保存 → 期望重定向回 /content/news
  await evalJs(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='保存')?.click()`);
  await new Promise((r) => setTimeout(r, 3500));
  const url = await evalJs(`location.pathname`);
  const listHasTitle = await evalJs(`document.body.innerText.includes(${JSON.stringify(uniqueTitle)})`);
  const errText = await evalJs(`document.querySelector('.text-\\\\[\\\\#DC2626\\\\]')?.textContent || ''`);
  console.log("③ 保存后路径:", url, "| 列表含新建标题:", listHasTitle, errText ? "| 错误:" + errText : "");
  if (url !== "/content/news" || !listHasTitle) fail++;

  console.log("控制台异常:", exceptions.length ? exceptions.slice(0, 3) : "无");
  if (exceptions.length) fail++;

  // 清理:删除刚建的记录(经 DB,避免污染)
  console.log(fail === 0 ? "\n浏览器实测 PASSED" : `\n浏览器实测 FAILED(${fail})`);
  await send("Target.closeTarget", { targetId });
  ws.close();
  console.log("CLEANUP_TITLE=" + uniqueTitle);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });

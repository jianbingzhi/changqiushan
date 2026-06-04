// 全量页面审计:逐页导航→截图→抓信号(控制台/占位/ISO日期/英文泄漏/空表)。只读不改。
const cdp = require("/home/agent/.claude/skills/cdp/lib/cdp");
const BASE = "http://10.7.0.1:3000";
const TOKEN = process.argv[2];
const ACT = "b8ca1ced-869f-442c-bbd5-696b92b9235a";
const DEV = "2926b87e-b6f3-443a-b99e-e230efdbaac0";

const PAGES = [
  ["01-dashboard", "/"],
  ["02-slots", "/booking/slots"],
  ["03-channels", "/booking/channels"],
  ["04-onsite", "/booking/onsite"],
  ["05-bookings", "/booking/bookings"],
  ["06-blacklist", "/riskcontrol/blacklist"],
  ["07-appeals", "/riskcontrol/blacklist?tab=appeals"],
  ["08-news", "/content/news"],
  ["09-intro", "/content/intro"],
  ["10-activities", "/content/activities"],
  ["11-knowledge", "/content/knowledge"],
  ["12-news-new", "/content/news/new"],
  ["13-activity-edit", `/content/activities/${ACT}/edit`],
  ["14-signups", `/content/activities/${ACT}/signups`],
  ["15-awards", `/content/activities/${ACT}/awards`],
  ["16-traffic", "/analytics/traffic"],
  ["17-heatmap", "/analytics/heatmap"],
  ["18-source", "/analytics/source"],
  ["19-profile", "/analytics/profile"],
  ["20-road", "/traffic/road"],
  ["21-parking", "/traffic/parking"],
  ["22-devices", "/iot/devices"],
  ["23-device-detail", `/iot/${DEV}`],
  ["24-system", "/system"],
  ["25-realtime", "/realtime"],
];

async function main() {
  const pages = await cdp.listTargets({ type: "page" });
  const conn = await cdp.connect(pages[0].id);
  const errs = [];
  await conn.send("Runtime.enable", {});
  await conn.send("Network.enable", {});
  await conn.send("Log.enable", {}).catch(() => {});
  conn.raw.on("message", (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      let t = null;
      if (m.method === "Runtime.exceptionThrown") t = "EXC " + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "");
      else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") t = "ERR " + (m.params.args || []).map(a => a.value || a.description || "").join(" ");
      else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") t = "LOG " + m.params.entry.text;
      if (t && !/webpack-hmr|favicon/.test(t)) errs.push(t.slice(0, 120));
    } catch {}
  });
  await conn.send("Network.setCookie", { name: "sb-access-token", value: TOKEN, domain: "10.7.0.1", path: "/", httpOnly: true, sameSite: "Lax" });

  const results = [];
  for (const [name, path] of PAGES) {
    errs.length = 0;
    const rec = { name, path };
    try {
      await cdp.navigate(conn, BASE + path);
      await cdp.waitForLoad(conn);
      await cdp.sleep(1800);
      rec.landed = await cdp.evaluate(conn, "location.pathname + location.search");
      rec.title = await cdp.evaluate(conn, "document.title");
      const facts = await cdp.evaluate(conn, `(()=>{
        const body=document.body.innerText;
        const vis=[...document.querySelectorAll('h1,h2,p,span,button,a,th,td,label')].map(e=>e.innerText).join(' ');
        const placeholders=(body.match(/加载中|占位|暂无数据|数据准备中|准备中|TODO|加载…|地图加载/g)||[]).length;
        const isoDates=(body.match(/20\\d\\d-\\d\\d-\\d\\d/g)||[]).length;
        const sseEn=(vis.match(/checkin_event|parking_state|iot_event|slot_changed/g)||[]).length;
        const emptyStates=(body.match(/暂无|未查询到|当日暂无/g)||[]).length;
        return {bodyLen:body.length, placeholders, isoDates, sseEn, emptyStates};
      })()`);
      Object.assign(rec, facts);
      rec.errs = errs.slice(0, 5);
      const shot = await cdp.screenshot(conn, `/tmp/poc-${name}.jpg`, { forHuman: true });
      rec.shotKB = Math.round(shot.bytes / 1024);
    } catch (e) {
      rec.error = (e && e.message || "").slice(0, 80);
    }
    results.push(rec);
    console.log(`${name.padEnd(18)} ${(rec.landed||rec.error||"?").slice(0,28).padEnd(28)} 占位${rec.placeholders??"?"} ISO${rec.isoDates??"?"} 英文${rec.sseEn??"?"} 空态${rec.emptyStates??"?"} err${(rec.errs||[]).length} ${rec.shotKB||0}KB`);
  }
  require("fs").writeFileSync("/tmp/poc-audit.json", JSON.stringify(results, null, 1));
  console.log("\n完成,", results.length, "页;明细 /tmp/poc-audit.json");
  conn.close();
  process.exit(0);
}
main().catch(e => { console.error("ERR", e && e.message); process.exit(1); });

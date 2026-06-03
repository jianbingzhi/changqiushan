// 实测 checkin_event SSE 链路:仪表盘注入监听 → 触发核销 → 看事件是否到达 + 卡片数字是否更新
const cdp = require("/home/agent/.claude/skills/cdp/lib/cdp");
const { Pool } = require("pg");
const BASE = "http://10.7.0.1:3000";
const TOKEN = process.argv[2];

const readCount = `(()=>{const ds=[...document.querySelectorAll('div')].filter(d=>d.textContent.includes('在园人数（实时）'));const c=ds[ds.length-1];const m=c&&c.textContent.match(/(\\d+)\\s*\\/\\s*\\d+/);return m?m[1]:null;})()`;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const pages = await cdp.listTargets({ type: "page" });
  const conn = await cdp.connect(pages[0].id);
  await conn.send("Network.enable", {});
  await conn.send("Network.setCookie", { name: "sb-access-token", value: TOKEN, domain: "10.7.0.1", path: "/", httpOnly: true, sameSite: "Lax" });

  await cdp.navigate(conn, BASE + "/");
  await cdp.waitForLoad(conn);
  await cdp.sleep(2000);

  // 注入 SSE 监听器(和卡片同一个频道)
  await cdp.evaluate(conn, `(()=>{window.__sse=[];const es=new EventSource('/api/sse/checkin_event');window.__es=es;es.addEventListener('checkin_event',e=>window.__sse.push(e.data));es.onmessage=e=>window.__sse.push('default:'+e.data);})()`);
  await cdp.sleep(1500);
  const before = await cdp.evaluate(conn, readCount);
  console.log("核销前 仪表盘在园人数:", before);

  // 触发真实核销:挑一条今日 CONFIRMED 预约 → CHECKED_IN(直接 DB 改,触发器随 UPDATE 触发)
  const { rows } = await pool.query(`
    SELECT b.id, b.slot_id FROM booking b JOIN booking_slot s ON s.id=b.slot_id
    WHERE b.status='CONFIRMED'::"BookingStatus" AND s.date=CURRENT_DATE LIMIT 1`);
  if (!rows.length) { console.log("无今日 CONFIRMED 预约可核销"); await pool.end(); conn.close(); process.exit(1); }
  const { id, slot_id } = rows[0];
  await pool.query(`UPDATE booking SET status='CHECKED_IN'::"BookingStatus", checked_in_at=NOW() WHERE id=$1`, [id]);
  await pool.query(`UPDATE booking_slot SET checked_in_count=checked_in_count+1 WHERE id=$1`, [slot_id]);
  console.log("已核销 1 笔(booking", id.slice(0, 8) + "), 触发器应已 NOTIFY checkin_event");

  await cdp.sleep(3500); // 等 SSE 推送
  const msgs = await cdp.evaluate(conn, `window.__sse`);
  const after = await cdp.evaluate(conn, readCount);
  console.log("浏览器收到的 SSE 事件:", JSON.stringify(msgs));
  console.log("核销后 仪表盘在园人数:", after, before === after ? "（没变 ✗）" : "（变了 ✓）");

  console.log("\n结论:");
  const arrived = Array.isArray(msgs) && msgs.some(m => m.includes("slot_id") || m.includes("checked_in"));
  console.log("  ① SSE 事件到达浏览器:", arrived ? "✓ 到了(基础设施通)" : "✗ 没到");
  const hasField = Array.isArray(msgs) && msgs.some(m => m.includes("checkedInCount") || m.includes("checked_in_count"));
  console.log("  ② payload 含卡片需要的 checkedInCount 字段:", hasField ? "✓" : "✗ 没有(卡片忽略,数字不更新)");
  console.log("  ③ 仪表盘数字实时更新:", before !== after ? "✓" : "✗ 未更新");

  await pool.end();
  conn.close();
  process.exit(0);
}
main().catch(e => { console.error("ERR", e && e.message); process.exit(1); });

// 端到端验证:DB trigger → NOTIFY → pg-listen → 回调
// 不走 Next.js,直接跑 Node 验证实时层
import "dotenv/config";
import createSubscriber from "pg-listen";
import { Client } from "pg";

const CONN = process.env["DATABASE_URL"];
if (!CONN) throw new Error("DATABASE_URL missing");

async function main() {
  const sub = createSubscriber({ connectionString: CONN });
  const received: unknown[] = [];

  sub.notifications.on("slot_changed", (payload) => {
    received.push(payload);
    console.log("[recv]", payload);
  });
  sub.events.on("error", (err) => {
    console.error("[pg-listen error]", err);
  });

  await sub.connect();
  await sub.listenTo("slot_changed");
  console.log("[ok] subscribed to slot_changed");

  const pg = new Client({ connectionString: CONN });
  await pg.connect();
  const before = Date.now();
  const r = await pg.query(
    "UPDATE booking_slot SET booked_count = booked_count + 1 WHERE name = '上午场 2' RETURNING id, booked_count",
  );
  console.log(`[update] rows=${r.rowCount}`);

  await new Promise((res) => setTimeout(res, 600));
  const elapsed = Date.now() - before;
  console.log(`[done] received ${received.length} events in ${elapsed}ms`);

  await pg.end();
  await sub.close();

  if (received.length === 0) {
    console.error("[FAIL] no events received");
    process.exit(1);
  }
  console.log("[PASS] chain works");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

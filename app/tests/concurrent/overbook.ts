/**
 * B6 / C·三 2.10 — 并发超约 + 单日重复 验证脚本(不走 Next.js,tsx 直跑)
 *   pnpm exec tsx tests/concurrent/overbook.ts
 *
 * 验两件事:
 *  ① 超约:capacity=quota=N,并发 M>N 笔(不同身份证)→ 恰好 N 笔成功,
 *     booked_count == N 且 <= capacity(乐观锁 + CHECK 双保险,不超卖)。
 *  ② 单日重复(E4):同一身份证并发 K 笔 → 恰好 1 笔成功(部分唯一索引兜底)。
 */
import "dotenv/config";
import { Pool } from "pg";
import { bookingService } from "@/modules/booking";

const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CHECK_CHARS = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
function genIdCard(seq: number): string {
  const body = ("1101011990" + String(seq).padStart(7, "0")).slice(0, 17);
  const sum = ID_WEIGHTS.reduce((a, w, i) => a + w * parseInt(body[i], 10), 0);
  return body + ID_CHECK_CHARS[sum % 11];
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const today = new Date().toISOString().slice(0, 10);
  const CAP = 5;
  const OVERBOOK = 20;
  let failures = 0;

  try {
    // 造一个干净的专用测试时段:capacity=quota=CAP
    const { rows } = await pool.query(
      `INSERT INTO booking_slot
         (id, name, date, start_time, end_time, capacity, booked_count,
          mini_program_quota, mini_program_booked, status, updated_at)
       VALUES (gen_random_uuid(), '并发测试场', $1::date, '08:00', '09:00', $2, 0, $2, 0, 'ACTIVE', NOW())
       RETURNING id`,
      [today, CAP],
    );
    const slotId: string = rows[0].id;

    // ① 超约:OVERBOOK 笔不同身份证并发
    const overbookResults = await Promise.all(
      Array.from({ length: OVERBOOK }, (_, i) =>
        bookingService.createBooking({
          slotId,
          visitorName: `游客${i}`,
          idCard: genIdCard(i + 1),
          phone: "13800000000",
          noVehicleDeclared: true,
          channel: "MINI_PROGRAM",
        }),
      ),
    );
    const okCount = overbookResults.filter((r) => r.ok).length;
    const counter = await pool.query(
      `SELECT booked_count, capacity FROM booking_slot WHERE id = $1`,
      [slotId],
    );
    const { booked_count, capacity } = counter.rows[0];
    console.log(`① 超约: ${okCount}/${OVERBOOK} 成功, booked_count=${booked_count}, capacity=${capacity}`);
    if (okCount !== CAP) { console.error(`  ✘ 期望 ${CAP} 笔成功`); failures++; }
    if (booked_count > capacity) { console.error(`  ✘ booked_count 超过 capacity`); failures++; }
    if (booked_count !== CAP) { console.error(`  ✘ booked_count 应等于 ${CAP}`); failures++; }
    if (failures === 0) console.log("  ✔ 不超卖");

    // ② 单日重复:同一身份证并发 K 笔(造第二个有空位的时段,避免与①争位)
    const { rows: r2 } = await pool.query(
      `INSERT INTO booking_slot
         (id, name, date, start_time, end_time, capacity, booked_count,
          mini_program_quota, mini_program_booked, status, updated_at)
       VALUES (gen_random_uuid(), '单日重复测试场', $1::date, '10:00', '11:00', 50, 0, 50, 0, 'ACTIVE', NOW())
       RETURNING id`,
      [today],
    );
    const slot2: string = r2[0].id;
    const dupId = genIdCard(999999);
    const dupResults = await Promise.all(
      Array.from({ length: 8 }, () =>
        bookingService.createBooking({
          slotId: slot2,
          visitorName: "重复游客",
          idCard: dupId,
          phone: "13800000000",
          noVehicleDeclared: true,
          channel: "MINI_PROGRAM",
        }),
      ),
    );
    const dupOk = dupResults.filter((r) => r.ok).length;
    console.log(`② 单日重复: ${dupOk}/8 成功(期望 1)`);
    if (dupOk !== 1) { console.error("  ✘ 同证同日应恰好 1 笔落库"); failures++; }
    else console.log("  ✔ 单日去重兜底生效");

    // 清理测试数据
    await pool.query(`DELETE FROM booking WHERE slot_id = ANY($1::uuid[])`, [[slotId, slot2]]);
    await pool.query(`DELETE FROM booking_slot WHERE id = ANY($1::uuid[])`, [[slotId, slot2]]);
  } finally {
    await pool.end();
  }

  if (failures > 0) { console.error(`\n并发验证 FAILED (${failures} 项)`); process.exit(1); }
  console.log("\n并发验证 PASSED");
}

main().catch((e) => { console.error(e); process.exit(1); });

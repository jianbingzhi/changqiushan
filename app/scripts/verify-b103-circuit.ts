// b-103 评审 #1 红线4 守卫验证(临时脚本,本地 dev DB):
// ① 显示口径:某日在园/承载 ≥90% 时,该日未物化派生行在 listSlotsForDate 中置 PAUSED;
// ② 写守卫:今日熔断时 createBooking 一律拒(CIRCUIT_BREAKER_OPEN),含派生路径;
// ③ 非当日不受写守卫影响(熔断只停「当日」预约)。
// 跑完恢复 park.instant_capacity 原值并清理测试行。
import "dotenv/config";
import { bookingService } from "../src/modules/booking";
import { db } from "../src/infrastructure/db/client";
import { chinaToday } from "../src/shared/lib/time";

const W = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const C = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
function makeId(seq: number): string {
  const body = "510107" + "19900101" + String(100 + (seq % 900)).slice(-3);
  const sum = W.reduce((a, w, i) => a + w * parseInt(body[i], 10), 0);
  return body + C[sum % 11];
}
let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name} ${detail}`); }
  else { fail++; console.log(`  ❌ ${name} ${detail}`); }
};
const toDb = (s: string) => new Date(s + "T00:00:00Z");
const plusDays = (n: number) => {
  const d = new Date(toDb(chinaToday()).getTime() + n * 86400000);
  return d.toISOString().slice(0, 10);
};

const CFG_KEY = "park.instant_capacity";
async function getCfg(): Promise<string | null> {
  const rows = await db.$queryRaw<{ value: string }[]>`SELECT value FROM system_config WHERE key = ${CFG_KEY} LIMIT 1`;
  return rows[0]?.value ?? null;
}
async function setCfg(v: string) {
  await db.$executeRaw`
    INSERT INTO system_config (key, value, value_type, label, updated_at)
    VALUES (${CFG_KEY}, ${v}, 'int', '瞬时承载量', NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}
async function delCfg() {
  await db.$executeRaw`DELETE FROM system_config WHERE key = ${CFG_KEY}`;
}

async function cleanupDate(dateStr: string) {
  const d = toDb(dateStr);
  const slots = await db.bookingSlot.findMany({ where: { date: d } });
  for (const s of slots) await db.booking.deleteMany({ where: { slotId: s.id } });
  await db.bookingSlot.deleteMany({ where: { date: d } });
  await db.bookingDailyCounter.deleteMany({ where: { date: d } });
}

async function main() {
  const today = chinaToday();
  const D_DISPLAY = plusDays(40);  // 显示口径测试日(隔离)
  const D_FUTURE  = plusDays(41);  // 非当日写路径测试日(隔离)
  const origCfg = await getCfg();
  console.log(`今日=${today} 显示测试日=${D_DISPLAY} 原承载配置=${origCfg ?? "(未设)"}`);

  try {
    // ===== ① 显示口径:D_DISPLAY 物化一个 checkedIn=9 的时段,承载=10 → ≥90% =====
    await cleanupDate(D_DISPLAY);
    await db.bookingSlot.create({
      data: {
        date: toDb(D_DISPLAY), name: "b103测试段", startTime: "23:30", endTime: "23:45",
        capacity: 20, miniProgramQuota: 5, onsiteQuota: 5, otaQuota: 5, adminQuota: 5,
        bookedCount: 9, checkedInCount: 9, status: "ACTIVE",
      },
    });
    await setCfg("10");
    const views = await bookingService.listSlotsForDate(D_DISPLAY);
    const derived = views.filter((v) => !v.materialized);
    check("显示:熔断日存在派生行(模板未全物化)", derived.length > 0, `derived=${derived.length}`);
    check("显示:熔断日派生行全部 PAUSED", derived.length > 0 && derived.every((v) => v.status === "PAUSED"));
    const mat = views.find((v) => v.materialized && v.startTime === "23:30");
    check("显示:物化行状态不被显示口径篡改(仍 ACTIVE)", mat?.status === "ACTIVE");

    // 承载恢复宽松 → 派生行回 ACTIVE
    await setCfg("100000");
    const relaxed = await bookingService.listSlotsForDate(D_DISPLAY);
    check("显示:承载放宽后派生行回 ACTIVE", relaxed.filter((v) => !v.materialized).every((v) => v.status === "ACTIVE"));

    // ===== ② 写守卫:把「今日」推到熔断态,任意时段下单一律拒 =====
    const todayInPark = (await db.bookingSlot.aggregate({ where: { date: toDb(today) }, _sum: { checkedInCount: true } }))._sum.checkedInCount ?? 0;
    // 配承载使 现有在园/承载 ≥ 90%(在园为 0 时配 0 → isCircuitBroken 为 false,故注入一个测试时段)
    let injectedToday = false;
    let inPark = todayInPark;
    if (inPark === 0) {
      await db.bookingSlot.create({
        data: {
          date: toDb(today), name: "b103测试段", startTime: "23:40", endTime: "23:55",
          capacity: 20, miniProgramQuota: 5, onsiteQuota: 5, otaQuota: 5, adminQuota: 5,
          bookedCount: 9, checkedInCount: 9, status: "ACTIVE",
        },
      });
      injectedToday = true;
      inPark = 9;
    }
    await setCfg(String(Math.max(1, Math.floor(inPark / 0.9))));
    const todaySlots = await bookingService.listSlotsForDate(today);
    const target = todaySlots.find((v) => !v.materialized) ?? todaySlots[0];
    const res = await bookingService.createBooking({
      slotId: target.id, date: today, visitorName: "熔断测试",
      idCard: makeId(801), phone: "13800009901", plate: "川A99901", channel: "MINI_PROGRAM",
    }, { dailyTotalStock: 0, perIdCard: 1, perPhone: 0 });
    check("写守卫:今日熔断时下单被拒", !res.ok, res.ok ? "竟然成功!" : `code=${res.ok ? "" : res.code}`);
    check("写守卫:错误码为 CIRCUIT_BREAKER_OPEN", !res.ok && res.code === "CIRCUIT_BREAKER_OPEN");
    if (injectedToday) {
      const s = await db.bookingSlot.findFirst({ where: { date: toDb(today), name: "b103测试段" } });
      if (s) { await db.booking.deleteMany({ where: { slotId: s.id } }); await db.bookingSlot.delete({ where: { id: s.id } }); }
    }

    // ===== ③ 非当日不受写守卫影响(熔断只停当日;承载仍是收紧值) =====
    await cleanupDate(D_FUTURE);
    const futSlots = await bookingService.listSlotsForDate(D_FUTURE);
    const futDerived = futSlots.find((v) => !v.materialized);
    if (futDerived) {
      const r2 = await bookingService.createBooking({
        slotId: futDerived.id, date: D_FUTURE, visitorName: "远期测试",
        idCard: makeId(802), phone: "13800009902", plate: "川A99902", channel: "MINI_PROGRAM",
      }, { dailyTotalStock: 0, perIdCard: 1, perPhone: 0 });
      check("写守卫:非当日派生下单不受熔断影响", r2.ok, r2.ok ? "" : `code=${r2.code} ${r2.message}`);
    } else {
      check("写守卫:远期派生行存在", false, "模板派生为空?");
    }
  } finally {
    // 恢复现场
    if (origCfg === null) await delCfg(); else await setCfg(origCfg);
    await cleanupDate(D_DISPLAY);
    await cleanupDate(D_FUTURE);
    await db.$disconnect();
  }

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

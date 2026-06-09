// B31 + B26 并发集成验证(临时脚本):超卖 / 每日总库存总闸 / 单证上限 / 单手机上限 / 取消回退。
// 各场景用独立远期日期隔离,跑完清理。仅本地 dev DB 用。
import "dotenv/config";
import { bookingService } from "../src/modules/booking";
import { db } from "../src/infrastructure/db/client";

const W = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const C = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
function makeId(seq: number): string {
  const body = "510107" + "19900101" + String(100 + (seq % 900)).slice(-3);
  const sum = W.reduce((a, w, i) => a + w * parseInt(body[i], 10), 0);
  return body + C[sum % 11];
}
const phone = (n: number) => "138" + String(10000000 + n);
let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name} ${detail}`); }
  else { fail++; console.log(`  ❌ ${name} ${detail}`); }
};

async function cleanupDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  const slots = await db.bookingSlot.findMany({ where: { date: d } });
  for (const s of slots) await db.booking.deleteMany({ where: { slotId: s.id } });
  await db.bookingSlot.deleteMany({ where: { date: d } });
  await db.bookingDailyCounter.deleteMany({ where: { date: d } });
}

async function book(date: string, slotId: string, seq: number, limits: { dailyTotalStock: number; perIdCard: number; perPhone: number }, over: Partial<{ idCard: string; phone: string }> = {}) {
  return bookingService.createBooking({
    slotId, date, visitorName: `测试${seq}`,
    idCard: over.idCard ?? makeId(seq), phone: over.phone ?? phone(seq),
    plate: `川A${String(10000 + seq).slice(-5)}`, channel: "MINI_PROGRAM",
  }, limits);
}

async function main() {
  const NO_LIMITS = { dailyTotalStock: 0, perIdCard: 1, perPhone: 0 };

  // ===== 1) 超卖:物化小配额时段,10 并发抢 mini 配额=3 =====
  console.log("\n[1] 超卖防护(mini 配额=3,10 并发)");
  const d1 = "2026-12-20";
  await cleanupDate(d1);
  const small = await db.bookingSlot.create({
    data: { name: "压测场", date: new Date(d1 + "T00:00:00Z"), startTime: "09:05", endTime: "10:05",
      capacity: 3, miniProgramQuota: 3, onsiteQuota: 0, otaQuota: 0, adminQuota: 0, status: "ACTIVE" },
  });
  const r1 = await Promise.all(Array.from({ length: 10 }, (_, i) => book(d1, small.id, 1000 + i, NO_LIMITS)));
  const ok1 = r1.filter((r) => r.ok).length;
  const row1 = await db.bookingSlot.findUnique({ where: { id: small.id } });
  check("成功数=配额3", ok1 === 3, `(实际 ${ok1})`);
  check("mini_booked=3 不超卖", row1?.miniProgramBooked === 3, `(实际 ${row1?.miniProgramBooked})`);

  // ===== 2) 每日总库存总闸:total_stock=5,8 笔(不同证)抢 =====
  console.log("\n[2] 每日总库存总闸(total=5,8 笔不同证)");
  const d2 = "2026-12-21";
  await cleanupDate(d2);
  const slots2 = await bookingService.listSlotsForDate(d2);
  const sid2 = slots2[0].id;
  const LIM2 = { dailyTotalStock: 5, perIdCard: 1, perPhone: 0 };
  const r2 = await Promise.all(Array.from({ length: 8 }, (_, i) => book(d2, sid2, 2000 + i, LIM2)));
  const ok2 = r2.filter((r) => r.ok).length;
  const counter2 = await db.bookingDailyCounter.findUnique({ where: { date: new Date(d2 + "T00:00:00Z") } });
  check("成功数=总库存5", ok2 === 5, `(实际 ${ok2})`);
  check("counter.total_booked=5", counter2?.totalBooked === 5, `(实际 ${counter2?.totalBooked})`);

  // ===== 3) 单证上限 N=1:同证两次 =====
  console.log("\n[3] 单证当日上限 N=1");
  const d3 = "2026-12-22";
  await cleanupDate(d3);
  const sid3 = (await bookingService.listSlotsForDate(d3))[0].id;
  const sameId = makeId(3001);
  const a = await book(d3, sid3, 3001, NO_LIMITS, { idCard: sameId, phone: phone(3001) });
  const b = await book(d3, sid3, 3002, NO_LIMITS, { idCard: sameId, phone: phone(3002) });
  check("首单成功", a.ok);
  check("同证次单被拒", !b.ok, b.ok ? "" : `(${b.message})`);

  // ===== 4) 单手机上限:per_phone=2,同手机 3 不同证 =====
  console.log("\n[4] 单手机当日上限=2");
  const d4 = "2026-12-23";
  await cleanupDate(d4);
  const sid4 = (await bookingService.listSlotsForDate(d4))[0].id;
  const LIM4 = { dailyTotalStock: 0, perIdCard: 1, perPhone: 2 };
  const ph = phone(4000);
  const p1 = await book(d4, sid4, 4001, LIM4, { phone: ph });
  const p2 = await book(d4, sid4, 4002, LIM4, { phone: ph });
  const p3 = await book(d4, sid4, 4003, LIM4, { phone: ph });
  check("前两单成功", p1.ok && p2.ok);
  check("同手机第三单被拒", !p3.ok, p3.ok ? "" : `(${p3.message})`);

  // ===== 5) 取消回退:总库存计数 -1 =====
  console.log("\n[5] 取消回退(counter 与 slot 同步 -1)");
  const d5 = "2026-12-24";
  await cleanupDate(d5);
  const sid5 = (await bookingService.listSlotsForDate(d5))[0].id;
  const LIM5 = { dailyTotalStock: 10, perIdCard: 1, perPhone: 0 };
  const c1 = await book(d5, sid5, 5001, LIM5);
  const beforeCounter = (await db.bookingDailyCounter.findUnique({ where: { date: new Date(d5 + "T00:00:00Z") } }))?.totalBooked;
  // cancelBooking 需校验 canCancel(距开始>2h);远期日期满足
  const cancelRes = c1.ok ? await bookingService.cancelBooking(c1.value.id) : null;
  const afterCounter = (await db.bookingDailyCounter.findUnique({ where: { date: new Date(d5 + "T00:00:00Z") } }))?.totalBooked;
  check("下单后 counter=1", beforeCounter === 1, `(实际 ${beforeCounter})`);
  check("取消成功", cancelRes?.ok === true);
  check("取消后 counter=0", afterCounter === 0, `(实际 ${afterCounter})`);

  // 清理
  for (const d of [d1, d2, d3, d4, d5]) await cleanupDate(d);

  console.log(`\n=== 结果:${pass} 通过 / ${fail} 失败 ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

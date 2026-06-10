// T5 验收(临时):copyDaySlots 逃生口——源日仅派生(无物化行)也能复制出物化行;幂等重跑全跳过。
import "dotenv/config";
import { bookingService, bookingRepository } from "../src/modules/booking";
import { db } from "../src/infrastructure/db/client";

const SRC = "2026-06-24"; // 远期工作日:无物化行,仅模板派生
const TGT = "2026-06-25";
const d = (s: string) => new Date(`${s}T00:00:00Z`);

async function main() {
  await db.bookingSlot.deleteMany({ where: { date: { in: [d(SRC), d(TGT)] } } });

  const srcMat = await bookingRepository.listSlotsByDate(d(SRC));
  console.log(`源日 ${SRC} 物化行=${srcMat.length}(应为 0,纯派生)`);

  const r1 = await bookingService.copyDaySlots(SRC, TGT);
  if (!r1.ok) throw new Error(`复制失败: ${r1.code} ${r1.message}`);
  console.log(`首次复制: created=${r1.value.created} skipped=${r1.value.skipped}`);

  const tgtMat = await bookingRepository.listSlotsByDate(d(TGT));
  console.log(`目标日 ${TGT} 物化行=${tgtMat.length}`);
  if (r1.value.created === 0 || tgtMat.length !== r1.value.created) throw new Error("逃生口未生效");

  const r2 = await bookingService.copyDaySlots(SRC, TGT);
  if (!r2.ok) throw new Error(`重跑失败: ${r2.code}`);
  console.log(`幂等重跑: created=${r2.value.created} skipped=${r2.value.skipped}`);
  if (r2.value.created !== 0) throw new Error("幂等失效:目标日去重未生效");

  await db.bookingSlot.deleteMany({ where: { date: { in: [d(SRC), d(TGT)] } } });
  console.log("✅ T5 copyDaySlots 验收通过(派生源可复制 + 目标日裸读去重幂等)");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

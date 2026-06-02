import "dotenv/config";
import { Pool } from "pg";

// 用纯 pg 写 seed,避免 Prisma 启动开销
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const slots = [
      { name: "上午场 1", start: "09:00", end: "10:30", capacity: 200 },
      { name: "上午场 2", start: "10:30", end: "12:00", capacity: 200 },
      { name: "下午场 1", start: "13:00", end: "14:30", capacity: 250 },
      { name: "下午场 2", start: "14:30", end: "16:00", capacity: 250 },
      { name: "傍晚场",   start: "16:00", end: "17:30", capacity: 150 },
    ];
    for (const s of slots) {
      // 渠道配额(B1 方案α):小程序 60% / 现场 20% / OTA 15% / 后台 5%(向上取整)
      const mini = Math.ceil(s.capacity * 0.6);
      const onsite = Math.ceil(s.capacity * 0.2);
      const ota = Math.ceil(s.capacity * 0.15);
      const admin = Math.ceil(s.capacity * 0.05);
      await pool.query(
        `INSERT INTO booking_slot
           (id, name, date, start_time, end_time, capacity, booked_count,
            mini_program_quota, onsite_quota, ota_quota, admin_quota,
            status, updated_at)
         VALUES (gen_random_uuid(), $1, $2::date, $3, $4, $5, 0,
            $6, $7, $8, $9, 'ACTIVE', NOW())
         ON CONFLICT DO NOTHING`,
        [s.name, dateStr, s.start, s.end, s.capacity, mini, onsite, ota, admin]
      );
    }
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM booking_slot WHERE date = $1::date", [dateStr]);
    console.log(`seed 完成: 今日(${dateStr}) booking_slot ${rows[0].n} 条`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

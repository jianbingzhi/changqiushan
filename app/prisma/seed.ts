import "dotenv/config";
import { Pool } from "pg";

// 用纯 pg 写 seed,避免 Prisma 启动开销。
// 造近 7 天的时段 + 多状态/多渠道预约,让 analytics 物化视图、B22 列表、B02 大屏有真实数据。

const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CHECK_CHARS = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
// 用出生日期 + 性别位构造合法身份证(便于 profile 画像派生)
function makeIdCard(region: string, birth: string, seq: number, male: boolean): string {
  const seqStr = String(seq).padStart(2, "0") + (male ? "1" : "0"); // 第17位奇男偶女
  const body = (region + birth + seqStr).slice(0, 17);
  const sum = ID_WEIGHTS.reduce((a, w, i) => a + w * parseInt(body[i], 10), 0);
  return body + ID_CHECK_CHARS[sum % 11];
}

const REGIONS = ["510107", "510108", "500103", "330106", "440305"];
const CHANNELS = ["MINI_PROGRAM", "ONSITE_MAKEUP", "OTA", "ADMIN_MANUAL"] as const;
const PLATES = ["川A12345", "川B88888", "渝A66666", "浙AD12345", "粤BF54321"];

// 确定性伪随机(避免每次 seed 数据漂移)
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const rnd = lcg(20260602);
  try {
    const slotDefs = [
      { name: "上午场 1", start: "09:00", end: "10:30", capacity: 200 },
      { name: "上午场 2", start: "10:30", end: "12:00", capacity: 200 },
      { name: "下午场 1", start: "13:00", end: "14:30", capacity: 250 },
      { name: "下午场 2", start: "14:30", end: "16:00", capacity: 250 },
      { name: "傍晚场",   start: "16:00", end: "17:30", capacity: 150 },
    ];

    let slotCount = 0;
    let bookingCount = 0;
    let idSeq = 0;

    // 近 7 天(含今日),今日索引为 0
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - dayOffset);
      const dateStr = d.toISOString().slice(0, 10);
      const isToday = dayOffset === 0;

      for (const s of slotDefs) {
        const mini = Math.ceil(s.capacity * 0.6);
        const onsite = Math.ceil(s.capacity * 0.2);
        const ota = Math.ceil(s.capacity * 0.15);
        const admin = Math.ceil(s.capacity * 0.05);

        const { rows } = await pool.query(
          `INSERT INTO booking_slot
             (id, name, date, start_time, end_time, capacity, booked_count,
              mini_program_quota, onsite_quota, ota_quota, admin_quota,
              status, updated_at)
           VALUES (gen_random_uuid(), $1, $2::date, $3, $4, $5, 0, $6, $7, $8, $9, 'ACTIVE', NOW())
           RETURNING id`,
          [s.name, dateStr, s.start, s.end, s.capacity, mini, onsite, ota, admin],
        );
        const slotId = rows[0].id as string;
        slotCount++;

        // 每个时段造 30~70 笔预约
        const n = 30 + Math.floor(rnd() * 40);
        const channelBooked: Record<string, number> = { mini_program: 0, onsite: 0, ota: 0, admin: 0 };
        let confirmedOrCheckedIn = 0;

        for (let i = 0; i < n; i++) {
          idSeq++;
          const male = rnd() > 0.5;
          const region = REGIONS[Math.floor(rnd() * REGIONS.length)];
          // 出生年 1955~2007,派生年龄段
          const year = 1955 + Math.floor(rnd() * 52);
          const birth = `${year}0${1 + Math.floor(rnd() * 8)}1${Math.floor(rnd() * 9)}`;
          const idCard = makeIdCard(region, birth, idSeq % 90, male);
          const channel = CHANNELS[Math.floor(rnd() * CHANNELS.length)];
          const hasVehicle = rnd() > 0.4;
          const plate = hasVehicle ? PLATES[Math.floor(rnd() * PLATES.length)] : null;

          // 状态分布:历史日多 CHECKED_IN/NO_SHOW,今日多 CONFIRMED
          let status: string;
          const r = rnd();
          if (isToday) status = r < 0.85 ? "CONFIRMED" : r < 0.95 ? "CANCELLED" : "CHECKED_IN";
          else status = r < 0.62 ? "CHECKED_IN" : r < 0.78 ? "NO_SHOW" : r < 0.9 ? "CONFIRMED" : "CANCELLED";

          const col = channel === "MINI_PROGRAM" ? "mini_program" : channel === "ONSITE_MAKEUP" ? "onsite" : channel === "OTA" ? "ota" : "admin";
          // 配额护栏:超额则降级到小程序
          const quotaMap: Record<string, number> = { mini_program: mini, onsite, ota, admin };
          const useCol = channelBooked[col] < quotaMap[col] ? col : "mini_program";
          if (channelBooked[useCol] >= quotaMap[useCol]) continue;
          channelBooked[useCol]++;
          if (status === "CONFIRMED" || status === "CHECKED_IN") confirmedOrCheckedIn++;

          const realChannel = useCol === "mini_program" ? "MINI_PROGRAM" : useCol === "onsite" ? "ONSITE_MAKEUP" : useCol === "ota" ? "OTA" : "ADMIN_MANUAL";
          const qr = "bk-seed-" + idSeq.toString(36) + "-" + Math.floor(rnd() * 1e9).toString(36);

          await pool.query(
            `INSERT INTO booking
               (id, slot_id, visitor_name, id_card, phone, plate, no_vehicle_declared,
                channel, status, qr_code, checked_in_at, cancelled_at, no_show_at, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::"BookingChannel", $8::"BookingStatus", $9,
                $10, $11, $12, NOW(), NOW())`,
            [
              slotId,
              (male ? "王" : "李") + "游客" + idSeq,
              idCard,
              "13" + String(800000000 + (idSeq % 99999999)).slice(0, 9),
              plate,
              plate === null,
              realChannel,
              status,
              qr,
              status === "CHECKED_IN" ? new Date() : null,
              status === "CANCELLED" ? new Date() : null,
              status === "NO_SHOW" ? new Date() : null,
            ],
          );
          bookingCount++;
        }

        // 回填时段计数器(与有效预约一致;在园计数取今日 CHECKED_IN 近似)
        const checkedIn = await pool.query(
          `SELECT COUNT(*)::int AS c FROM booking WHERE slot_id=$1 AND status='CHECKED_IN'::"BookingStatus"`,
          [slotId],
        );
        await pool.query(
          `UPDATE booking_slot SET
             mini_program_booked=$2, onsite_booked=$3, ota_booked=$4, admin_booked=$5,
             booked_count=$6, checked_in_count=$7
           WHERE id=$1`,
          [slotId, channelBooked.mini_program, channelBooked.onsite, channelBooked.ota, channelBooked.admin, confirmedOrCheckedIn, checkedIn.rows[0].c],
        );
      }
    }

    // 刷新物化视图(首刷非 CONCURRENTLY 即可)
    await pool.query(`REFRESH MATERIALIZED VIEW analytics_daily_traffic`);
    await pool.query(`REFRESH MATERIALIZED VIEW analytics_visitor_source`);
    await pool.query(`REFRESH MATERIALIZED VIEW analytics_hourly_peak`);

    console.log(`seed 完成: booking_slot ${slotCount} 条, booking ${bookingCount} 条, 已刷新 3 个物化视图`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

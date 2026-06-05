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
          const qr = "bk-" + idSeq.toString(36) + "-" + Math.floor(rnd() * 1e9).toString(36);

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

    // 风控:几条黑名单 + 一条待审申诉(B11 验证用)
    const blEntries = [
      { idCard: "510107198803151230", plate: "川A99999", reason: "累计爽约 3 次,自动加入黑名单" },
      { idCard: "330106197705204527", plate: null, reason: "现场违规,人工加入" },
      { idCard: "500103199210083019", plate: "渝B12388", reason: "累计爽约 3 次,自动加入黑名单" },
    ];
    const userIds: string[] = [];
    for (const e of blEntries) {
      const { createHash } = await import("node:crypto");
      const h = createHash("sha256").update(e.idCard).digest("hex");
      const uid = `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-${((parseInt(h[16],16)&0x3)|0x8).toString(16)}${h.slice(17,20)}-${h.slice(20,32)}`;
      userIds.push(uid);
      await pool.query(
        `INSERT INTO risk_blacklist (id, user_id, id_card, plate, reason, blacklisted_at, created_at)
         VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, NOW() - interval '2 days', NOW() - interval '2 days')
         ON CONFLICT (user_id) DO NOTHING`,
        [uid, e.idCard, e.plate, e.reason],
      );
    }
    // 第一条黑名单提交一条待审申诉
    const { rows: blRows } = await pool.query(`SELECT id FROM risk_blacklist WHERE user_id=$1::uuid`, [userIds[0]]);
    if (blRows[0]) {
      await pool.query(
        `INSERT INTO risk_appeal (id, blacklist_id, user_id, reason, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, 'PENDING'::"AppealStatus", NOW(), NOW())`,
        [blRows[0].id, userIds[0], "本人因临时急事未能到场,已知悉规则,恳请解除黑名单,后续必按时履约。"],
      );
    }

    // 内容:资讯 / 介绍 / 知识库 / 活动 + 报名(B03-B07/B23 验证用)
    const news = [
      { title: "长秋山森林公园 2026 年春季开园公告", summary: "即日起恢复全天预约入园，免费不售票。", status: "PUBLISHED" },
      { title: "五一假期预约入园指南", summary: "请提前在小程序预约，携带身份证与车牌信息。", status: "PUBLISHED" },
      { title: "园区步道临时维护通知（草稿）", summary: null, status: "DRAFT" },
    ];
    for (const n of news) {
      await pool.query(
        `INSERT INTO content_news (id,title,summary,body,status,published_at,created_at,updated_at)
         VALUES (gen_random_uuid(),$1,$2,'正文内容（演示数据）。',$3::"ContentStatus",CASE WHEN $3='PUBLISHED' THEN NOW() ELSE NULL END,NOW(),NOW())`,
        [n.title, n.summary, n.status],
      );
    }
    const intros = [
      { title: "公园概况", order: 1, status: "PUBLISHED" },
      { title: "主要景点", order: 2, status: "PUBLISHED" },
      { title: "游览路线建议", order: 3, status: "DRAFT" },
    ];
    for (const it of intros) {
      await pool.query(
        `INSERT INTO content_intro (id,title,body,status,sort_order,published_at,created_at,updated_at)
         VALUES (gen_random_uuid(),$1,'介绍正文（演示数据）。',$2::"ContentStatus",$3,CASE WHEN $2='PUBLISHED' THEN NOW() ELSE NULL END,NOW(),NOW())`,
        [it.title, it.status, it.order],
      );
    }
    const knowledge = [
      { title: "公园开放时间是几点？", category: "游览", status: "PUBLISHED" },
      { title: "可以自驾进入吗？停车怎么收费？", category: "交通", status: "PUBLISHED" },
      { title: "园区有哪些无障碍设施？", category: "设施", status: "PUBLISHED" },
      { title: "近期有哪些活动？", category: "活动", status: "DRAFT" },
    ];
    for (const k of knowledge) {
      await pool.query(
        `INSERT INTO content_knowledge (id,title,content,category,sort_order,status,created_at,updated_at)
         VALUES (gen_random_uuid(),$1,'答案正文（演示数据）。',$2,0,$3::"ContentStatus",NOW(),NOW())`,
        [k.title, k.category, k.status],
      );
    }
    const activities = [
      { title: "长秋山观鸟节", fee: 0, status: "PUBLISHED", days: [-5, 10] },
      { title: "森林徒步挑战赛", fee: 50, status: "PUBLISHED", days: [2, 3] },
      { title: "自然研学夏令营", fee: 200, status: "DRAFT", days: [20, 25] },
    ];
    for (const a of activities) {
      const sd = new Date(); sd.setDate(sd.getDate() + a.days[0]);
      const ed = new Date(); ed.setDate(ed.getDate() + a.days[1]);
      const { rows: ar } = await pool.query(
        `INSERT INTO content_activity (id,title,description,start_date,end_date,max_participants,registration_fee,status,published_at,created_at,updated_at)
         VALUES (gen_random_uuid(),$1,'活动详情（演示数据）。',$2,$3,100,$4,$5::"ContentStatus",CASE WHEN $5='PUBLISHED' THEN NOW() ELSE NULL END,NOW(),NOW())
         RETURNING id`,
        [a.title, sd.toISOString(), ed.toISOString(), a.fee, a.status],
      );
      // 每个活动几条报名(混合支付状态)
      const actId = ar[0].id;
      const pays = a.fee === 0 ? ["PAID", "PAID", "PAID"] : ["PAID", "PAID", "UNPAID", "REFUNDED"];
      for (let i = 0; i < pays.length; i++) {
        await pool.query(
          `INSERT INTO content_activity_signup (id,activity_id,user_id,user_name,phone,payment_status,paid_at,created_at,updated_at)
           VALUES (gen_random_uuid(),$1,$2,$3,$4,$5::"PaymentStatus",CASE WHEN $5='PAID' THEN NOW() ELSE NULL END,NOW(),NOW())`,
          [actId, "u" + i, "报名游客" + i, "138" + String(10000000 + i).slice(0, 8), pays[i]],
        );
      }
      // 观鸟节公示获奖名单(B24 验证用)
      if (a.title === "长秋山观鸟节") {
        const awards = [
          { name: "陈伟", phone: "13811112222", title: "一等奖·最佳观鸟记录" },
          { name: "林芳", phone: "13933334444", title: "二等奖·优秀摄影" },
          { name: "赵敏", phone: "13755556666", title: "三等奖·人气之星" },
        ];
        for (const aw of awards) {
          await pool.query(
            `INSERT INTO content_award (id,activity_id,winner_name,phone,award_title,announced_at,created_at)
             VALUES (gen_random_uuid(),$1,$2,$3,$4,NOW() - interval '1 day',NOW())`,
            [actId, aw.name, aw.phone, aw.title],
          );
        }
      }
    }

    // IoT 设备 + 近 24h 心跳(B20 列表 / B21 详情验证用)
    const devices = [
      { name: "东门闸机-01", type: "闸机", location: "东门入口", status: "ONLINE" },
      { name: "西门闸机-02", type: "闸机", location: "西门入口", status: "ONLINE" },
      { name: "观景台摄像头-01", type: "摄像头", location: "主峰观景台", status: "ALERT" },
      { name: "停车场地磁-A区", type: "地磁传感器", location: "A 区停车场", status: "ONLINE" },
      { name: "气象站-主峰", type: "气象站", location: "主峰", status: "OFFLINE" },
    ];
    for (const dv of devices) {
      const online = dv.status === "ONLINE" || dv.status === "ALERT";
      const { rows: dr } = await pool.query(
        `INSERT INTO iot_device (id,name,type,location,status,last_seen,created_at,updated_at)
         VALUES (gen_random_uuid(),$1,$2,$3,$4::"DeviceStatus",$5,NOW(),NOW())
         ON CONFLICT (name) DO UPDATE SET status=EXCLUDED.status RETURNING id`,
        [dv.name, dv.type, dv.location, dv.status, online ? new Date() : new Date(Date.now() - 3600_000 * 6)],
      );
      const devId = dr[0].id;
      // 近 24h 每 30 分钟一条心跳(共 48 条)
      for (let i = 0; i < 48; i++) {
        const ts = new Date(Date.now() - i * 30 * 60_000);
        const alert = dv.status === "ALERT";
        const latency = Math.round(40 + rnd() * (alert ? 400 : 120));
        const loss = (rnd() * (alert ? 8 : 1.5)).toFixed(2);
        const sig = -1 * Math.round(50 + rnd() * 40);
        await pool.query(
          `INSERT INTO iot_heartbeat (id,device_id,latency,packet_loss,signal_strength,recorded_at,created_at)
           VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,NOW())`,
          [devId, latency, loss, sig, ts.toISOString()],
        );
      }
    }

    // 停车场(B13 验证用)
    const lots = [
      { name: "东门生态停车场", capacity: 300, occupied: 180, status: "OPEN" },
      { name: "西门停车场", capacity: 200, occupied: 200, status: "FULL" },
      { name: "主峰临时停车场", capacity: 120, occupied: 45, status: "OPEN" },
      { name: "游客中心地下车库", capacity: 150, occupied: 0, status: "CLOSED" },
    ];
    for (const lot of lots) {
      await pool.query(
        `INSERT INTO traffic_parking_lot (id,name,capacity,occupied,status,location,updated_at,created_at)
         VALUES (gen_random_uuid(),$1,$2,$3,$4::"ParkingStatus",$5,NOW(),NOW())
         ON CONFLICT (name) DO UPDATE SET occupied=EXCLUDED.occupied, status=EXCLUDED.status`,
        [lot.name, lot.capacity, lot.occupied, lot.status, lot.name],
      );
    }

    // 系统:角色 + 权限矩阵 + 展示用账号 + 审计日志(B25 验证用)
    const roleDefs = [
      { code: "SUPER_ADMIN", name: "超级管理员" },
      { code: "ADMIN", name: "管理员" },
      { code: "OPERATOR", name: "操作员" },
    ];
    const roleIds: Record<string, string> = {};
    for (const r of roleDefs) {
      const { rows } = await pool.query(
        `INSERT INTO sys_role (id,name,code,created_at) VALUES (gen_random_uuid(),$1,$2,NOW())
         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [r.name, r.code],
      );
      roleIds[r.code] = rows[0].id;
    }
    const permDefs = [
      { code: "booking:read", name: "预约查看", resource: "booking", action: "read" },
      { code: "booking:write", name: "预约管理", resource: "booking", action: "write" },
      { code: "checkin:write", name: "核销操作", resource: "checkin", action: "write" },
      { code: "content:write", name: "内容管理", resource: "content", action: "write" },
      { code: "riskcontrol:write", name: "风控管理", resource: "riskcontrol", action: "write" },
      { code: "analytics:read", name: "数据查看", resource: "analytics", action: "read" },
      { code: "export:data", name: "报表导出", resource: "export", action: "data" },
      { code: "system:manage", name: "系统管理", resource: "system", action: "manage" },
    ];
    const permIds: Record<string, string> = {};
    for (const p of permDefs) {
      const { rows } = await pool.query(
        `INSERT INTO sys_permission (id,name,code,resource,action) VALUES (gen_random_uuid(),$1,$2,$3,$4)
         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [p.name, p.code, p.resource, p.action],
      );
      permIds[p.code] = rows[0].id;
    }
    const matrix: Record<string, string[]> = {
      SUPER_ADMIN: permDefs.map((p) => p.code),
      ADMIN: ["booking:read", "booking:write", "checkin:write", "content:write", "riskcontrol:write", "analytics:read", "export:data"],
      OPERATOR: ["booking:read", "checkin:write"],
    };
    for (const [code, perms] of Object.entries(matrix)) {
      for (const pc of perms) {
        await pool.query(
          `INSERT INTO sys_role_permission (role_id,permission_id) VALUES ($1::uuid,$2::uuid) ON CONFLICT DO NOTHING`,
          [roleIds[code], permIds[pc]],
        );
      }
    }
    // 展示用账号(随机 UUID,非真实 GoTrue 用户;真实登录账号见 scripts/seed-admin.ts)
    const profiles = [
      { name: "园区管理员", worker: "ADM-001", role: "SUPER_ADMIN", status: "ACTIVE" },
      { name: "运营专员", worker: "OPS-007", role: "ADMIN", status: "ACTIVE" },
      { name: "闸机操作员", worker: "GATE-012", role: "OPERATOR", status: "ACTIVE" },
      { name: "离职员工", worker: "OPS-003", role: "OPERATOR", status: "DISABLED" },
    ];
    const actorIds: string[] = [];
    for (const p of profiles) {
      const { rows } = await pool.query(
        `INSERT INTO sys_profile (id,name,worker_id,status,created_at,updated_at)
         VALUES (gen_random_uuid(),$1,$2,$3::"SysProfileStatus",NOW(),NOW()) RETURNING id`,
        [p.name, p.worker, p.status],
      );
      actorIds.push(rows[0].id);
      await pool.query(`INSERT INTO sys_profile_role (profile_id,role_id) VALUES ($1::uuid,$2::uuid) ON CONFLICT DO NOTHING`, [rows[0].id, roleIds[p.role]]);
    }
    const audits = [
      { action: "CREATE_ADMIN", resource: "sys_profile", detail: { name: "运营专员" } },
      { action: "DISABLE_ADMIN", resource: "sys_profile", detail: { name: "离职员工" } },
      { action: "REVIEW_APPEAL", resource: "risk_appeal", detail: { decision: "APPROVED" } },
      { action: "EXPORT_REPORT", resource: "export", detail: { module: "traffic" } },
    ];
    for (let i = 0; i < audits.length; i++) {
      const a = audits[i];
      await pool.query(
        `INSERT INTO sys_audit_log (id,actor_id,action,resource,detail,created_at)
         VALUES (gen_random_uuid(),$1::uuid,$2,$3,$4::jsonb,NOW() - ($5 || ' hours')::interval)`,
        [actorIds[0], a.action, a.resource, JSON.stringify(a.detail), String(i * 3)],
      );
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

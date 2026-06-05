import { Prisma } from "@prisma/client";
import { db } from "@/infrastructure/db/client";
import { toCstDateStr } from "@/shared/lib/time";

// B2: 所有物化视图查询集中在此文件，使用 $queryRaw + 手写 TS 返回类型
// Prisma 不能查物化视图，必须走原始 SQL

export interface DailyTrafficRow {
  date:             string;
  total_visitors:   bigint;
  checked_in_count: bigint;
  cancelled_count:  bigint;
  noshow_count:     bigint;
}

export interface VisitorSourceRow {
  source_channel: string;
  visitor_count:  bigint;
  percentage:     number;
}

export interface HourlyPeakRow {
  hour:         number;
  avg_visitors: number;
  max_visitors: bigint;
}

export interface ProfileOverviewRow {
  dimension:  string;
  value:      bigint;
  percentage: number;
}

export const analyticsRepository = {
  getDailyTraffic(startDate: Date, endDate: Date): Promise<DailyTrafficRow[]> {
    const start = toCstDateStr(startDate);
    const end   = toCstDateStr(endDate);
    return db.$queryRaw<DailyTrafficRow[]>(Prisma.sql`
      SELECT date, total_visitors, checked_in_count, cancelled_count, noshow_count
      FROM analytics_daily_traffic
      WHERE date BETWEEN ${start} AND ${end}
      ORDER BY date
    `);
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getVisitorSource(_startDate?: Date, _endDate?: Date): Promise<VisitorSourceRow[]> {
    return db.$queryRaw<VisitorSourceRow[]>(Prisma.sql`
      SELECT source_channel, visitor_count, percentage
      FROM analytics_visitor_source
      ORDER BY visitor_count DESC
    `);
  },

  getHourlyPeak(): Promise<HourlyPeakRow[]> {
    return db.$queryRaw<HourlyPeakRow[]>(Prisma.sql`
      SELECT hour, avg_visitors, max_visitors
      FROM analytics_hourly_peak
      ORDER BY hour ASC
    `);
  },

  // 用户画像总览:按去重游客(身份证)派生性别 + 年龄段。
  // 身份证第 17 位奇男偶女,第 7~10 位为出生年。运行时聚合(画像维度低基数,无需 MV)。
  getProfileOverview(): Promise<ProfileOverviewRow[]> {
    return db.$queryRaw<ProfileOverviewRow[]>(Prisma.sql`
      WITH visitors AS (
        SELECT DISTINCT ON (id_card)
          id_card,
          (substring(id_card FROM 17 FOR 1)::int % 2)                              AS gender_bit,
          (EXTRACT(YEAR FROM CURRENT_DATE)::int - substring(id_card FROM 7 FOR 4)::int) AS age
        FROM booking
        WHERE status <> 'CANCELLED'::"BookingStatus"
          AND id_card ~ '^[0-9]{17}[0-9Xx]$'
      ),
      total AS (SELECT COUNT(*)::numeric AS n FROM visitors)
      SELECT q.dimension, q.value,
             ROUND(q.value::numeric / NULLIF((SELECT n FROM total), 0) * 100, 2)::float AS percentage
      FROM (
        SELECT '性别·男' AS dimension, COUNT(*) FILTER (WHERE gender_bit = 1) AS value FROM visitors
        UNION ALL SELECT '性别·女',      COUNT(*) FILTER (WHERE gender_bit = 0) FROM visitors
        UNION ALL SELECT '年龄·18岁以下', COUNT(*) FILTER (WHERE age < 18) FROM visitors
        UNION ALL SELECT '年龄·18-30岁',  COUNT(*) FILTER (WHERE age BETWEEN 18 AND 30) FROM visitors
        UNION ALL SELECT '年龄·31-45岁',  COUNT(*) FILTER (WHERE age BETWEEN 31 AND 45) FROM visitors
        UNION ALL SELECT '年龄·46-60岁',  COUNT(*) FILTER (WHERE age BETWEEN 46 AND 60) FROM visitors
        UNION ALL SELECT '年龄·60岁以上', COUNT(*) FILTER (WHERE age > 60) FROM visitors
      ) q
      ORDER BY q.dimension
    `);
  },

  // 出行偏好:自驾比例 + 偏好入园时段(从 booking×slot 派生)
  getTravelPreference(): Promise<ProfileOverviewRow[]> {
    return db.$queryRaw<ProfileOverviewRow[]>(Prisma.sql`
      WITH b AS (
        SELECT bk.plate, EXTRACT(HOUR FROM s.start_time::time)::int AS hr
        FROM booking bk JOIN booking_slot s ON s.id = bk.slot_id
        WHERE bk.status <> 'CANCELLED'::"BookingStatus"
      ),
      total AS (SELECT COUNT(*)::numeric AS n FROM b)
      SELECT q.dimension, q.value,
             ROUND(q.value::numeric / NULLIF((SELECT n FROM total), 0) * 100, 2)::float AS percentage
      FROM (
        SELECT '出行·自驾' AS dimension, COUNT(*) FILTER (WHERE plate IS NOT NULL) AS value FROM b
        UNION ALL SELECT '出行·非自驾', COUNT(*) FILTER (WHERE plate IS NULL) FROM b
        UNION ALL SELECT '时段·上午(12时前)', COUNT(*) FILTER (WHERE hr < 12) FROM b
        UNION ALL SELECT '时段·下午(12-16时)', COUNT(*) FILTER (WHERE hr >= 12 AND hr < 16) FROM b
        UNION ALL SELECT '时段·傍晚(16时后)', COUNT(*) FILTER (WHERE hr >= 16) FROM b
      ) q
      ORDER BY q.dimension
    `);
  },
};

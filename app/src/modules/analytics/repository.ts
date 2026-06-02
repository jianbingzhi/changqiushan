import { Prisma } from "@prisma/client";
import { db } from "@/infrastructure/db/client";

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

export const analyticsRepository = {
  getDailyTraffic(startDate: Date, endDate: Date): Promise<DailyTrafficRow[]> {
    const start = startDate.toISOString().slice(0, 10);
    const end   = endDate.toISOString().slice(0, 10);
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
};

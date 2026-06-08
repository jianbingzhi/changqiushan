-- C4 预约分时热力:7×24(星期×小时)聚合 MV。
-- dow 归一为 0=周一 .. 6=周日(pg EXTRACT(DOW) 0=周日,故 (+6)%7);
-- 按所有历史日期落到该星期几累加,呈现「典型一周」的分时节律。
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_weekly_hourly_heat AS
SELECT
  ((EXTRACT(DOW FROM bs.date)::int + 6) % 7)            AS dow,
  EXTRACT(HOUR FROM bs.start_time::time)::int           AS hour,
  COALESCE(SUM(bs.booked_count), 0)::bigint             AS bookings,
  COALESCE(SUM(bs.checked_in_count), 0)::bigint         AS checkins
FROM booking_slot bs
GROUP BY 1, 2;

-- REFRESH ... CONCURRENTLY 需唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_weekly_hourly_heat_dow_hour
  ON analytics_weekly_hourly_heat (dow, hour);

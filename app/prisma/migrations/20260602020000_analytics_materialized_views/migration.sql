-- analytics 物化视图 — D4 双轨：固定聚合用 MV，自由下钻用运行时 $queryRaw
-- Prisma 不管理这些视图；pg-boss 定时 REFRESH CONCURRENTLY

-- ── 每日客流汇总 ────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_daily_traffic AS
SELECT
  bs.date::text                                         AS date,
  COUNT(DISTINCT b.id)                                  AS total_visitors,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'CHECKED_IN'::"BookingStatus")  AS checked_in_count,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'CANCELLED'::"BookingStatus")   AS cancelled_count,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'NO_SHOW'::"BookingStatus")     AS noshow_count
FROM booking_slot bs
LEFT JOIN booking b ON b.slot_id = bs.id
GROUP BY bs.date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_daily_traffic_date
  ON analytics_daily_traffic (date);

-- ── 渠道来源分布 ─────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_visitor_source AS
WITH totals AS (
  SELECT COUNT(*) AS grand_total FROM booking WHERE status != 'CANCELLED'::"BookingStatus"
)
SELECT
  b.channel::text                                       AS source_channel,
  COUNT(*)                                              AS visitor_count,
  ROUND(COUNT(*)::numeric / NULLIF(t.grand_total, 0) * 100, 2)::float AS percentage
FROM booking b
CROSS JOIN totals t
WHERE b.status != 'CANCELLED'::"BookingStatus"
GROUP BY b.channel, t.grand_total;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_visitor_source_channel
  ON analytics_visitor_source (source_channel);

-- ── 时段峰值分析 ─────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_hourly_peak AS
SELECT
  EXTRACT(HOUR FROM start_time::time)::int             AS hour,
  ROUND(AVG(booked_count)::numeric, 1)::float          AS avg_visitors,
  MAX(booked_count)                                     AS max_visitors
FROM booking_slot
GROUP BY EXTRACT(HOUR FROM start_time::time);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_hourly_peak_hour
  ON analytics_hourly_peak (hour);

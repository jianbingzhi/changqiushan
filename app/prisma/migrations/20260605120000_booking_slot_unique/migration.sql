-- C4 TOCTOU 兜底:时段「同日 + 同开始时间」唯一。
-- 原 (date, start_time) 为非唯一索引,check-then-insert 在并发/双提交下会建出重复时段;
-- 改为唯一索引后,重复插入触发 P2002,由 service 捕获返回冲突提示。唯一索引同时充当原查询索引。
DROP INDEX IF EXISTS "booking_slot_date_start_time_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "booking_slot_date_start_time_key"
  ON "booking_slot" ("date", "start_time");

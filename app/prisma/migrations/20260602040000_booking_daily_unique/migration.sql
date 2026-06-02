-- E4: 单日预约去重的 DB 层兜底 — 堵 countDailyBookings 检查与 insert 之间的 TOCTOU。
-- 免费抢约高并发下,service 层 count>0 检查与 insert 非原子,两请求可双双落库。
-- 业务口径为"同一身份证 + 同一天"判重,但 date 在 booking_slot 上,booking 无 date 列,
-- 故反范式 slot_date 到 booking,再建部分唯一索引按"天"兜底。

-- 1) 反范式列
ALTER TABLE booking ADD COLUMN IF NOT EXISTS slot_date DATE;

-- 2) 回填存量
UPDATE booking b
SET    slot_date = s.date
FROM   booking_slot s
WHERE  b.slot_id = s.id AND b.slot_date IS NULL;

-- 3) 触发器:insert 或改 slot_id 时,从所属时段同步 slot_date(业务代码无需关心)
CREATE OR REPLACE FUNCTION booking_sync_slot_date() RETURNS trigger AS $$
BEGIN
  SELECT date INTO NEW.slot_date FROM booking_slot WHERE id = NEW.slot_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_slot_date_sync ON booking;
CREATE TRIGGER booking_slot_date_sync
  BEFORE INSERT OR UPDATE OF slot_id ON booking
  FOR EACH ROW EXECUTE FUNCTION booking_sync_slot_date();

-- 4) 同一身份证 + 同一天 仅允许一条"有效"预约。
--    取消/爽约/过期后可重新预约,故部分唯一索引仅约束 CONFIRMED/CHECKED_IN。
CREATE UNIQUE INDEX IF NOT EXISTS booking_idcard_date_active_uq
  ON booking (id_card, slot_date)
  WHERE status IN ('CONFIRMED'::"BookingStatus", 'CHECKED_IN'::"BookingStatus");

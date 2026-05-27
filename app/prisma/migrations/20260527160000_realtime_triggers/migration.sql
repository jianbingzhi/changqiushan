-- Postgres LISTEN/NOTIFY 触发器
-- 业务表数据变化 → NOTIFY <channel>, json → pg-listen → 内存 bus → SSE → 大屏

-- =========================================
-- booking_slot 配额变化 → NOTIFY 'slot_changed'
-- =========================================
CREATE OR REPLACE FUNCTION notify_slot_changed()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  payload := json_build_object(
    'op', TG_OP,
    'id', COALESCE(NEW.id, OLD.id),
    'capacity', COALESCE(NEW.capacity, OLD.capacity),
    'booked_count', COALESCE(NEW.booked_count, OLD.booked_count),
    'date', COALESCE(NEW.date, OLD.date),
    'at', NOW()
  );
  PERFORM pg_notify('slot_changed', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_slot_notify ON booking_slot;
CREATE TRIGGER booking_slot_notify
  AFTER INSERT OR UPDATE OR DELETE ON booking_slot
  FOR EACH ROW EXECUTE FUNCTION notify_slot_changed();

-- =========================================
-- booking 状态变化 → NOTIFY 'checkin_event'(仅 CHECKED_IN 状态变更)
-- =========================================
CREATE OR REPLACE FUNCTION notify_checkin_event()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status = 'CHECKED_IN' AND OLD.status != 'CHECKED_IN') THEN
    payload := json_build_object(
      'id', NEW.id,
      'slot_id', NEW.slot_id,
      'checked_in_at', NEW.checked_in_at,
      'channel', NEW.channel
    );
    PERFORM pg_notify('checkin_event', payload::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_checkin_notify ON booking;
CREATE TRIGGER booking_checkin_notify
  AFTER UPDATE ON booking
  FOR EACH ROW EXECUTE FUNCTION notify_checkin_event();

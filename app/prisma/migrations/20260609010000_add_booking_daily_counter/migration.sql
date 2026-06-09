-- B31 防黄牛规则层(PRD 1.2):每日总库存计数表 + 三个运营阈值默认值。

CREATE TABLE IF NOT EXISTS "booking_daily_counter" (
  "date"         DATE          NOT NULL,
  "total_booked" INTEGER       NOT NULL DEFAULT 0,
  "updated_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "booking_daily_counter_pkey" PRIMARY KEY ("date")
);

-- 运营阈值(幂等)。total_stock=0 表示不设总闸(始终计数、不拦截);
-- per_idcard 默认 1(配合既有部分唯一索引 booking_idcard_date_active_uq 快路径);
-- per_phone 默认 0=关闭(家庭多证同手机场景,待 PRD 确认是否开)。
INSERT INTO "system_config" ("key", "value", "value_type", "label") VALUES
  ('booking.daily_total_stock',      '0', 'int', '每日总库存上限(0=不限)'),
  ('booking.daily_limit_per_idcard', '1', 'int', '单身份证单日预约上限'),
  ('booking.daily_limit_per_phone',  '0', 'int', '单手机号单日预约上限(0=不限)')
ON CONFLICT ("key") DO NOTHING;

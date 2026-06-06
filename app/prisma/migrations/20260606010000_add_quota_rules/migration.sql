-- BE-A2 配额规则引擎:时段模板 + 节假日日历(B23 cron 的定义端)。
CREATE TYPE "DayType" AS ENUM ('WEEKDAY', 'WEEKEND', 'HOLIDAY');

-- 按日期类型的时段模板;各渠道配额随模板带出,capacity = 四渠道之和(与手动建时段同口径)。
CREATE TABLE IF NOT EXISTS "booking_slot_template" (
  "id"                 UUID         NOT NULL DEFAULT gen_random_uuid(),
  "day_type"           "DayType"    NOT NULL,
  "name"               VARCHAR(80)  NOT NULL,
  "start_time"         VARCHAR(5)   NOT NULL,
  "end_time"           VARCHAR(5)   NOT NULL,
  "mini_program_quota" INTEGER      NOT NULL DEFAULT 0,
  "onsite_quota"       INTEGER      NOT NULL DEFAULT 0,
  "ota_quota"          INTEGER      NOT NULL DEFAULT 0,
  "admin_quota"        INTEGER      NOT NULL DEFAULT 0,
  "enabled"            BOOLEAN      NOT NULL DEFAULT true,
  "created_at"         TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "booking_slot_template_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "booking_slot_template_day_type_start_time_key"
  ON "booking_slot_template" ("day_type", "start_time");

-- 节假日/调休/闭园覆盖(运营手录,覆盖星期推断)。
CREATE TABLE IF NOT EXISTS "booking_holiday_calendar" (
  "date"       DATE          NOT NULL,
  "day_type"   "DayType"     NOT NULL,
  "closed"     BOOLEAN       NOT NULL DEFAULT false,
  "note"       VARCHAR(80),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "booking_holiday_calendar_pkey" PRIMARY KEY ("date")
);

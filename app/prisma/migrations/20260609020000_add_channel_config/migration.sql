-- B33③ 渠道接入配置表(R-只读 CRUD 补齐)。code 即 BookingChannel 枚举,固定 4 条种子。

CREATE TABLE IF NOT EXISTS "booking_channel_config" (
  "code"        "BookingChannel" NOT NULL,
  "label"       VARCHAR(40)      NOT NULL,
  "description" VARCHAR(120)     NOT NULL,
  "enabled"     BOOLEAN          NOT NULL DEFAULT true,
  "sort_order"  INTEGER          NOT NULL DEFAULT 0,
  "updated_at"  TIMESTAMPTZ(3)   NOT NULL DEFAULT now(),
  CONSTRAINT "booking_channel_config_pkey" PRIMARY KEY ("code")
);

INSERT INTO "booking_channel_config" ("code", "label", "description", "enabled", "sort_order") VALUES
  ('MINI_PROGRAM',  '微信小程序', '微信小程序在线预约',        true, 1),
  ('ONSITE_MAKEUP', '现场补录',   '管理员现场录入补录',        true, 2),
  ('OTA',           '第三方平台', '第三方平台（美团/携程）推送', true, 3),
  ('ADMIN_MANUAL',  '后台代录',   '后台管理员直接创建',        true, 4)
ON CONFLICT ("code") DO NOTHING;

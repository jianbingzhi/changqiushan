-- BE-A1 配置底座:通用 KV 运营配置(承载量/告警比例/滚动天数/默认配额等运营可改值)。
-- 读经 system 模块 configService(进程内缓存 TTL 60s);跨模块所需配置由 app 路由层注入。
CREATE TABLE IF NOT EXISTS "system_config" (
  "key"        TEXT          NOT NULL,
  "value"      TEXT          NOT NULL,
  "value_type" VARCHAR(10)   NOT NULL,
  "label"      VARCHAR(80)   NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);

-- 默认运营值(幂等):运营可在配置页改动;缺失时各处仍有 env/常量兜底。
INSERT INTO "system_config" ("key", "value", "value_type", "label") VALUES
  ('park.instant_capacity', '5000', 'int', '瞬时承载量(人)'),
  ('slot.horizon_days',     '14',   'int', '时段滚动生成天数'),
  ('slot.default_capacity', '300',  'int', '默认时段容量(人)')
ON CONFLICT ("key") DO NOTHING;

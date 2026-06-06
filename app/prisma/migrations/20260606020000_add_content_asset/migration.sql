-- R-素材 媒体素材库:上传归档,活动/资讯封面可引用。activity_id 可空 → 通用素材库。
CREATE TABLE IF NOT EXISTS "content_asset" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "activity_id" UUID,
  "name"        VARCHAR(120) NOT NULL,
  "key"         VARCHAR(255) NOT NULL,
  "url"         VARCHAR(512) NOT NULL,
  "type"        VARCHAR(40)  NOT NULL,
  "size"        INTEGER      NOT NULL,
  "created_by"  UUID,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "content_asset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "content_asset_key_key" ON "content_asset" ("key");
CREATE INDEX IF NOT EXISTS "content_asset_activity_id_created_at_idx"
  ON "content_asset" ("activity_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "content_asset_created_at_idx"
  ON "content_asset" ("created_at" DESC);

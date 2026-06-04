-- 动态核销码派生密钥:展示码退为 30s 滚动 TOTP,qrCode 退居稳定核销主键
-- 加列(可空)→ 回填存量(不依赖 pgcrypto,用 gen_random_uuid 拼 64 hex)→ 置非空
ALTER TABLE "booking" ADD COLUMN "qr_secret" VARCHAR(64);

UPDATE "booking"
SET "qr_secret" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE "qr_secret" IS NULL;

ALTER TABLE "booking" ALTER COLUMN "qr_secret" SET NOT NULL;

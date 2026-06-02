-- B11 latent fix: 申诉→黑名单 FK 改 RESTRICT→CASCADE。
-- reviewAppeal 通过时会删除 risk_blacklist 行,原 RESTRICT FK 会阻断(23001)。
ALTER TABLE "risk_appeal" DROP CONSTRAINT IF EXISTS "risk_appeal_blacklist_id_fkey";
ALTER TABLE "risk_appeal"
  ADD CONSTRAINT "risk_appeal_blacklist_id_fkey"
  FOREIGN KEY ("blacklist_id") REFERENCES "risk_blacklist"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

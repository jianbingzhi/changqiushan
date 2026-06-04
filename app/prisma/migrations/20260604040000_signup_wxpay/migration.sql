-- 活动报名微信支付字段(隔离;入园主流程零支付不变)
ALTER TABLE "content_activity_signup" ADD COLUMN "wx_order_id" VARCHAR(64);
ALTER TABLE "content_activity_signup" ADD COLUMN "wx_transaction_id" VARCHAR(64);

-- 回调幂等:交易号唯一
CREATE UNIQUE INDEX "content_activity_signup_wx_transaction_id_key" ON "content_activity_signup"("wx_transaction_id");

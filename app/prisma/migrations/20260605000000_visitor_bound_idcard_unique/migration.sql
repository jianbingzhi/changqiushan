-- 实名绑定唯一性(评审 #3):一个身份证只能绑定一个微信账号,防冒占他人实名
-- Postgres 唯一索引默认允许多个 NULL → 未绑定游客不受约束
DROP INDEX IF EXISTS "wechat_visitor_bound_id_card_idx";

CREATE UNIQUE INDEX "wechat_visitor_bound_id_card_key" ON "wechat_visitor"("bound_id_card");

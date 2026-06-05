-- CreateTable
CREATE TABLE "wechat_visitor" (
    "id" UUID NOT NULL,
    "openid" VARCHAR(64) NOT NULL,
    "unionid" VARCHAR(64),
    "nickname" VARCHAR(80),
    "avatar_url" TEXT,
    "bound_id_card" VARCHAR(32),
    "phone" VARCHAR(20),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wechat_visitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wechat_visitor_openid_key" ON "wechat_visitor"("openid");

-- CreateIndex
CREATE INDEX "wechat_visitor_bound_id_card_idx" ON "wechat_visitor"("bound_id_card");

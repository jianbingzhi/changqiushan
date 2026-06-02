-- CreateTable
CREATE TABLE "content_award" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "winner_name" VARCHAR(40) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "award_title" VARCHAR(80) NOT NULL,
    "announced_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_award_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_award_activity_id_announced_at_idx" ON "content_award"("activity_id", "announced_at" DESC);

-- AddForeignKey
ALTER TABLE "content_award" ADD CONSTRAINT "content_award_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "content_activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "content_poi" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "description" TEXT,
    "cover_image" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_poi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_poi_status_category_idx" ON "content_poi"("status", "category");

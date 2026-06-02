-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ALERT');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SysProfileStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ParkingStatus" AS ENUM ('OPEN', 'FULL', 'CLOSED');

-- CreateTable
CREATE TABLE "checkin_log" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "checked_in_at" TIMESTAMPTZ(3) NOT NULL,
    "checked_in_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_intro" (
    "id" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "body" TEXT NOT NULL,
    "cover_image" VARCHAR(255),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(3),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_intro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_activity" (
    "id" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "cover_image" VARCHAR(255),
    "start_date" TIMESTAMPTZ(3) NOT NULL,
    "end_date" TIMESTAMPTZ(3) NOT NULL,
    "max_participants" INTEGER,
    "registration_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_activity_signup" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "user_id" VARCHAR(32) NOT NULL,
    "user_name" VARCHAR(40) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paid_at" TIMESTAMPTZ(3),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_activity_signup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_knowledge" (
    "id" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "content" TEXT NOT NULL,
    "category" VARCHAR(40),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_news" (
    "id" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "cover_image" VARCHAR(255),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_device" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "location" VARCHAR(255),
    "status" "DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "last_seen" TIMESTAMPTZ(3),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "iot_device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_heartbeat" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "latency" INTEGER NOT NULL,
    "packet_loss" DECIMAL(5,2) NOT NULL,
    "signal_strength" INTEGER,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iot_heartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_noshow_counter" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "last_no_show_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_noshow_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_blacklist" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "id_card" VARCHAR(32) NOT NULL,
    "plate" VARCHAR(16),
    "reason" TEXT,
    "blacklisted_at" TIMESTAMPTZ(3) NOT NULL,
    "reviewed_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_appeal" (
    "id" UUID NOT NULL,
    "blacklist_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "review_note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "risk_appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_profile" (
    "id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "worker_id" VARCHAR(32),
    "status" "SysProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sys_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_role" (
    "id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_permission" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "resource" VARCHAR(40) NOT NULL,
    "action" VARCHAR(20) NOT NULL,

    CONSTRAINT "sys_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_profile_role" (
    "profile_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "sys_profile_role_pkey" PRIMARY KEY ("profile_id","role_id")
);

-- CreateTable
CREATE TABLE "sys_role_permission" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "sys_role_permission_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "sys_audit_log" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "resource" VARCHAR(40) NOT NULL,
    "detail" JSONB,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traffic_parking_lot" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "occupied" INTEGER NOT NULL DEFAULT 0,
    "status" "ParkingStatus" NOT NULL DEFAULT 'OPEN',
    "coordinates" JSONB,
    "location" VARCHAR(255),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traffic_parking_lot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checkin_log_booking_id_key" ON "checkin_log"("booking_id");

-- CreateIndex
CREATE INDEX "checkin_log_slot_id_checked_in_at_idx" ON "checkin_log"("slot_id", "checked_in_at");

-- CreateIndex
CREATE INDEX "content_intro_status_sort_order_idx" ON "content_intro"("status", "sort_order");

-- CreateIndex
CREATE INDEX "content_activity_status_start_date_idx" ON "content_activity"("status", "start_date");

-- CreateIndex
CREATE INDEX "content_activity_signup_activity_id_payment_status_idx" ON "content_activity_signup"("activity_id", "payment_status");

-- CreateIndex
CREATE INDEX "content_knowledge_category_sort_order_idx" ON "content_knowledge"("category", "sort_order");

-- CreateIndex
CREATE INDEX "content_news_status_published_at_idx" ON "content_news"("status", "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "iot_device_name_key" ON "iot_device"("name");

-- CreateIndex
CREATE INDEX "iot_device_status_last_seen_idx" ON "iot_device"("status", "last_seen");

-- CreateIndex
CREATE INDEX "iot_heartbeat_device_id_recorded_at_idx" ON "iot_heartbeat"("device_id", "recorded_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "risk_noshow_counter_user_id_key" ON "risk_noshow_counter"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_blacklist_user_id_key" ON "risk_blacklist"("user_id");

-- CreateIndex
CREATE INDEX "risk_blacklist_id_card_idx" ON "risk_blacklist"("id_card");

-- CreateIndex
CREATE INDEX "risk_appeal_user_id_created_at_idx" ON "risk_appeal"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "risk_appeal_status_created_at_idx" ON "risk_appeal"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sys_role_code_key" ON "sys_role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sys_permission_code_key" ON "sys_permission"("code");

-- CreateIndex
CREATE INDEX "sys_permission_resource_action_idx" ON "sys_permission"("resource", "action");

-- CreateIndex
CREATE INDEX "sys_audit_log_actor_id_created_at_idx" ON "sys_audit_log"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sys_audit_log_resource_action_created_at_idx" ON "sys_audit_log"("resource", "action", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "traffic_parking_lot_name_key" ON "traffic_parking_lot"("name");

-- CreateIndex
CREATE INDEX "booking_id_card_created_at_idx" ON "booking"("id_card", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "content_activity_signup" ADD CONSTRAINT "content_activity_signup_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "content_activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_heartbeat" ADD CONSTRAINT "iot_heartbeat_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "iot_device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_appeal" ADD CONSTRAINT "risk_appeal_blacklist_id_fkey" FOREIGN KEY ("blacklist_id") REFERENCES "risk_blacklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_profile_role" ADD CONSTRAINT "sys_profile_role_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "sys_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_profile_role" ADD CONSTRAINT "sys_profile_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "sys_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_role_permission" ADD CONSTRAINT "sys_role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "sys_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_role_permission" ADD CONSTRAINT "sys_role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "sys_permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;


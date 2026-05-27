-- CreateEnum
CREATE TYPE "BookingSlotStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BookingChannel" AS ENUM ('MINI_PROGRAM', 'ONSITE_MAKEUP', 'OTA', 'ADMIN_MANUAL');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'EXPIRED');

-- CreateTable
CREATE TABLE "booking_slot" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "booked_count" INTEGER NOT NULL DEFAULT 0,
    "status" "BookingSlotStatus" NOT NULL DEFAULT 'ACTIVE',
    "remark" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "booking_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "visitor_name" VARCHAR(40) NOT NULL,
    "id_card" VARCHAR(32) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "plate" VARCHAR(16),
    "channel" "BookingChannel" NOT NULL DEFAULT 'MINI_PROGRAM',
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "qr_code" VARCHAR(64) NOT NULL,
    "checked_in_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "no_show_at" TIMESTAMPTZ(3),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_slot_date_start_time_idx" ON "booking_slot"("date", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "booking_qr_code_key" ON "booking"("qr_code");

-- CreateIndex
CREATE INDEX "booking_phone_idx" ON "booking"("phone");

-- CreateIndex
CREATE INDEX "booking_id_card_idx" ON "booking"("id_card");

-- CreateIndex
CREATE INDEX "booking_status_created_at_idx" ON "booking"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "booking_slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

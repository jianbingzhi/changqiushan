-- 2.1a: booking_slot 渠道配额字段 + 在园计数
ALTER TABLE booking_slot
  ADD COLUMN IF NOT EXISTS mini_program_quota  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onsite_quota        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ota_quota           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_quota         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mini_program_booked INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onsite_booked       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ota_booked          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_booked        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checked_in_count    INTEGER NOT NULL DEFAULT 0;

-- 2.1a: booking 无车声明字段
ALTER TABLE booking
  ADD COLUMN IF NOT EXISTS no_vehicle_declared BOOLEAN NOT NULL DEFAULT FALSE;

-- 2.1b: DB CHECK 约束 — Prisma schema 不支持 CHECK,走手写 migration 兜底
-- booked_count 不超 capacity
ALTER TABLE booking_slot
  DROP CONSTRAINT IF EXISTS booking_slot_booked_count_check;
ALTER TABLE booking_slot
  ADD CONSTRAINT booking_slot_booked_count_check
    CHECK (booked_count <= capacity);

-- 各渠道 booked 不超各渠道 quota
ALTER TABLE booking_slot
  DROP CONSTRAINT IF EXISTS booking_slot_channel_booked_check;
ALTER TABLE booking_slot
  ADD CONSTRAINT booking_slot_channel_booked_check
    CHECK (
      mini_program_booked <= mini_program_quota AND
      onsite_booked       <= onsite_quota       AND
      ota_booked          <= ota_quota           AND
      admin_booked        <= admin_quota
    );

-- plate 与 no_vehicle_declared 互斥:至少有一个成立(XOR)
-- (plate IS NOT NULL) XOR no_vehicle_declared — 即两者不能同时真也不能同时假
ALTER TABLE booking
  DROP CONSTRAINT IF EXISTS booking_vehicle_xor_check;
ALTER TABLE booking
  ADD CONSTRAINT booking_vehicle_xor_check
    CHECK (
      (plate IS NOT NULL AND no_vehicle_declared = FALSE) OR
      (plate IS NULL     AND no_vehicle_declared = TRUE)
    );

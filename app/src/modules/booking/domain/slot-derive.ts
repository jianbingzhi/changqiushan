import { createHash } from "crypto";
import type { DayType, SysSlotTemplate } from "@prisma/client";
import { inferDayType } from "./quota-rule";

// B26 时段派生层(纯函数,不碰 DB)。把「时段模板 ⊕ 节假日特例」按某日展开成虚拟时段,
// 取代 cron 预生成的物化行作为读路径基准;首单时再惰性物化(见 repository.materializeAndBook)。

// 固定命名空间(项目私有,任意合法 16 字节 UUID 即可)。虚拟 id = UUIDv5(NS, date|startTime),
// 确定性:同一(日期,开始时间)恒得同一 id,使虚拟 id 与物化后 id 一致(下单免回查、并发更稳)。
const SLOT_NAMESPACE = "b26b26b2-6000-5000-8000-000000000026";

function uuidV5(name: string, namespace: string): string {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1")
    .update(nsBytes)
    .update(Buffer.from(name, "utf8"))
    .digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 确定性虚拟时段 id:同 (北京日历日, 开始时间) → 同 UUIDv5。 */
export function deriveSlotId(dateStr: string, startTime: string): string {
  return uuidV5(`${dateStr}|${startTime}`, SLOT_NAMESPACE);
}

// 派生时段:形状与 BookingSlot 对齐(已用量恒 0、状态 ACTIVE),加 materialized:false 标识。
// 合并读路径里「已物化优先」,故派生行只用于尚无物化行的开始时间。
export type DerivedSlot = {
  id:                string;
  date:              Date;
  name:              string;
  startTime:         string;
  endTime:           string;
  capacity:          number;
  miniProgramQuota:  number;
  onsiteQuota:       number;
  otaQuota:          number;
  adminQuota:        number;
  miniProgramBooked: number;
  onsiteBooked:      number;
  otaBooked:         number;
  adminBooked:       number;
  bookedCount:       number;
  checkedInCount:    number;
  status:            "ACTIVE";
  materialized:      false;
};

export type HolidayOverride = { dayType: DayType | null; closed: boolean } | null | undefined;

/**
 * 按某北京日历日派生时段。闭园特例 → [];否则按 inferDayType 选模板(各渠道名额来自模板)。
 * capacity = 四渠道配额之和(与手动建时段、cron 生成同口径)。
 */
export function deriveSlots(
  dateStr: string,
  enabledTemplates: SysSlotTemplate[],
  holidayOverride?: HolidayOverride,
): DerivedSlot[] {
  if (holidayOverride?.closed) return [];
  const dayType = inferDayType(dateStr, holidayOverride?.dayType ?? null);
  const date = new Date(`${dateStr}T00:00:00Z`);

  return enabledTemplates
    .filter((t) => t.dayType === dayType)
    .map((t) => ({
      id:                deriveSlotId(dateStr, t.startTime),
      date,
      name:              t.name,
      startTime:         t.startTime,
      endTime:           t.endTime,
      capacity:          t.miniProgramQuota + t.onsiteQuota + t.otaQuota + t.adminQuota,
      miniProgramQuota:  t.miniProgramQuota,
      onsiteQuota:       t.onsiteQuota,
      otaQuota:          t.otaQuota,
      adminQuota:        t.adminQuota,
      miniProgramBooked: 0,
      onsiteBooked:      0,
      otaBooked:         0,
      adminBooked:       0,
      bookedCount:       0,
      checkedInCount:    0,
      status:            "ACTIVE" as const,
      materialized:      false as const,
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

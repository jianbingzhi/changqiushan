import { z } from "zod";
import type { DayType } from "@prisma/client";

// BE-A2/A3 配额规则纯逻辑:由日期推断日期类型(无副作用,不碰 DB)。
// 周末用星期推算;HOLIDAY 一律靠运营在节假日日历手录覆盖(国务院每年公布,不可纯星期推算)。
// 入参为北京日历日串 YYYY-MM-DD,锚 UTC 零点取 getUTCDay,避免服务器时区把星期挪偏。
export function inferDayType(dateStr: string, override?: DayType | null): DayType {
  if (override) return override;
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6 ? "WEEKEND" : "WEEKDAY";
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 时段模板增改:各渠道配额之和即总名额,与手动建时段同口径。
export const slotTemplateSchema = z
  .object({
    dayType:   z.enum(["WEEKDAY", "WEEKEND", "HOLIDAY"]),
    name:      z.string().min(1, "时段名不能为空").max(80),
    startTime: z.string().regex(TIME_RE, "开始时间格式无效"),
    endTime:   z.string().regex(TIME_RE, "结束时间格式无效"),
    miniProgramQuota: z.coerce.number().int().min(0).max(100000).default(0),
    onsiteQuota:      z.coerce.number().int().min(0).max(100000).default(0),
    otaQuota:         z.coerce.number().int().min(0).max(100000).default(0),
    adminQuota:       z.coerce.number().int().min(0).max(100000).default(0),
    enabled:   z.boolean().default(true),
  })
  .refine((v) => v.endTime > v.startTime, { message: "结束时间须晚于开始时间", path: ["endTime"] })
  .refine(
    (v) => v.miniProgramQuota + v.onsiteQuota + v.otaQuota + v.adminQuota > 0,
    { message: "各渠道名额之和须大于 0", path: ["miniProgramQuota"] },
  );

export type SlotTemplateInput = z.infer<typeof slotTemplateSchema>;

// 节假日日历增改(主键即日期 → upsert 语义)。
export const holidaySchema = z.object({
  date:    z.string().regex(DATE_RE, "日期格式无效"),
  dayType: z.enum(["WEEKDAY", "WEEKEND", "HOLIDAY"]),
  closed:  z.boolean().default(false),
  note:    z.string().max(80).optional(),
});

export type HolidayInput = z.infer<typeof holidaySchema>;

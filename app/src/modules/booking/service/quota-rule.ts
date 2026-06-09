import { Prisma } from "@prisma/client";
import type { SysSlotTemplate, SysHolidayCalendar, DayType } from "@prisma/client";
import { bookingRepository } from "../repository";
import { slotTemplateSchema, holidaySchema, inferDayType } from "../domain/quota-rule";
import { deriveSlots } from "../domain/slot-derive";
import { ok, err, ErrCode, type Result } from "@/shared/result";

// B31 配额日历单元格:每格映射 B26 派生/物化语义,供信息密度日历直接消费。
export type DayCell = {
  date:         string;                          // YYYY-MM-DD
  dayType:      DayType;
  source:       "BASE" | "OVERRIDE" | "CLOSED";  // 基准星期推断 / 运营特例 / 闭园
  totalQuota:   number;                          // 当日各时段名额之和(物化优先,否则派生)
  usedQuota:    number;                          // 已占用(仅物化行有真实占用)
  materialized: boolean;                         // 当日是否已有物化行
};

// booking_holiday_calendar.date 是 @db.Date;锚 UTC 零点,与建时段/查时段口径一致。
const toDbDate = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`);

const pad2 = (n: number) => String(n).padStart(2, "0");

const isUniqueConflict = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export const quotaRuleService = {
  listTemplates(): Promise<SysSlotTemplate[]> {
    return bookingRepository.listSlotTemplates();
  },

  // B31 契约:派生整月配额日历。每格 = 派生(基准/特例/闭园)⊕ 物化真实占用,已物化优先。
  async resolveMonth(year: number, month: number): Promise<DayCell[]> {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const firstStr = `${year}-${pad2(month)}-01`;
    const lastStr = `${year}-${pad2(month)}-${pad2(daysInMonth)}`;
    const [templates, holidays, slots] = await Promise.all([
      bookingRepository.listEnabledTemplates(),
      bookingRepository.listHolidayCalendar(toDbDate(firstStr), toDbDate(lastStr)),
      bookingRepository.listSlotsInRange(toDbDate(firstStr), toDbDate(lastStr)),
    ]);
    const holidayByDate = new Map(holidays.map((h) => [h.date.toISOString().slice(0, 10), h]));
    const slotsByDate = new Map<string, typeof slots>();
    for (const s of slots) {
      const k = s.date.toISOString().slice(0, 10);
      const arr = slotsByDate.get(k);
      if (arr) arr.push(s);
      else slotsByDate.set(k, [s]);
    }

    const cells: DayCell[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad2(month)}-${pad2(d)}`;
      const ov = holidayByDate.get(dateStr) ?? null;
      const dayType = inferDayType(dateStr, ov?.dayType ?? null);
      const matRows = slotsByDate.get(dateStr) ?? [];
      const source: DayCell["source"] = ov?.closed ? "CLOSED" : ov ? "OVERRIDE" : "BASE";

      // 合并名额:闭园日不派生(但保留已物化真实占用);非闭园派生 ⊕ 物化优先
      const byStart = new Map<string, { capacity: number; used: number }>();
      if (!ov?.closed) {
        for (const ds of deriveSlots(dateStr, templates, ov)) {
          byStart.set(ds.startTime, { capacity: ds.capacity, used: 0 });
        }
      }
      for (const m of matRows) byStart.set(m.startTime, { capacity: m.capacity, used: m.bookedCount });

      let totalQuota = 0;
      let usedQuota = 0;
      for (const v of byStart.values()) {
        totalQuota += v.capacity;
        usedQuota += v.used;
      }
      cells.push({ date: dateStr, dayType, source, totalQuota, usedQuota, materialized: matRows.length > 0 });
    }
    return cells;
  },

  async createTemplate(raw: unknown): Promise<Result<SysSlotTemplate>> {
    const parsed = slotTemplateSchema.safeParse(raw);
    if (!parsed.success) {
      return err(ErrCode.INVALID_INPUT, parsed.error.issues[0]?.message ?? "输入校验失败");
    }
    try {
      const tpl = await bookingRepository.createSlotTemplate(parsed.data);
      return ok(tpl);
    } catch (e) {
      if (isUniqueConflict(e)) return err(ErrCode.CONFLICT, "该日期类型下已存在相同开始时间的模板");
      throw e;
    }
  },

  async updateTemplate(id: string, raw: unknown): Promise<Result<SysSlotTemplate>> {
    const parsed = slotTemplateSchema.safeParse(raw);
    if (!parsed.success) {
      return err(ErrCode.INVALID_INPUT, parsed.error.issues[0]?.message ?? "输入校验失败");
    }
    try {
      const tpl = await bookingRepository.updateSlotTemplate(id, parsed.data);
      return ok(tpl);
    } catch (e) {
      if (isUniqueConflict(e)) return err(ErrCode.CONFLICT, "该日期类型下已存在相同开始时间的模板");
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return err(ErrCode.NOT_FOUND, "模板不存在");
      }
      throw e;
    }
  },

  async deleteTemplate(id: string): Promise<Result<void>> {
    try {
      await bookingRepository.deleteSlotTemplate(id);
      return ok(undefined);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return err(ErrCode.NOT_FOUND, "模板不存在");
      }
      throw e;
    }
  },

  listHolidays(): Promise<SysHolidayCalendar[]> {
    return bookingRepository.listHolidays();
  },

  async upsertHoliday(raw: unknown): Promise<Result<SysHolidayCalendar>> {
    const parsed = holidaySchema.safeParse(raw);
    if (!parsed.success) {
      return err(ErrCode.INVALID_INPUT, parsed.error.issues[0]?.message ?? "输入校验失败");
    }
    const { date, dayType, closed, note } = parsed.data;
    const row = await bookingRepository.upsertHoliday({
      date: toDbDate(date),
      dayType,
      closed,
      note: note ?? null,
    });
    return ok(row);
  },

  async deleteHoliday(dateStr: string): Promise<Result<void>> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return err(ErrCode.INVALID_INPUT, "日期格式无效");
    }
    try {
      await bookingRepository.deleteHoliday(toDbDate(dateStr));
      return ok(undefined);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return err(ErrCode.NOT_FOUND, "该日期无特例记录");
      }
      throw e;
    }
  },
};

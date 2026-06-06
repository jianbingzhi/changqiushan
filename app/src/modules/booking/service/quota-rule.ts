import { Prisma } from "@prisma/client";
import type { SysSlotTemplate, SysHolidayCalendar } from "@prisma/client";
import { bookingRepository } from "../repository";
import { slotTemplateSchema, holidaySchema } from "../domain/quota-rule";
import { ok, err, ErrCode, type Result } from "@/shared/result";

// booking_holiday_calendar.date 是 @db.Date;锚 UTC 零点,与建时段/查时段口径一致。
const toDbDate = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`);

const isUniqueConflict = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export const quotaRuleService = {
  listTemplates(): Promise<SysSlotTemplate[]> {
    return bookingRepository.listSlotTemplates();
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

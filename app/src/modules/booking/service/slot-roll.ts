import type { Prisma } from "@prisma/client";
import { bookingRepository } from "../repository";
import { inferDayType } from "../domain/quota-rule";
import { ok, type Result } from "@/shared/result";
import { chinaToday } from "@/shared/lib/time";

// 北京日历日串 +offset 天(锚 UTC 零点做日历运算,与建/查时段口径一致,不依赖会话时区)。
function addDays(dateStr: string, offset: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export type RollResult = {
  created: number;   // 实际新建(幂等跳过已存在后)
  candidates: number; // 本次展开的候选时段数
  days: number;      // 覆盖天数
  closedDays: number; // 闭园跳过天数
};

// BE-A3 每日滚动生成:按模板 + 特例日历,把未来 horizonDays 天的时段幂等展开。
// horizonDays 由调用方(cron route / instrumentation / action)从 SysConfig 读出注入,
// 守 eslint-boundaries:booking 模块不反向 import system 模块。
export const slotRollService = {
  async rollGenerateSlots(horizonDays: number): Promise<Result<RollResult>> {
    const days = Number.isFinite(horizonDays) && horizonDays > 0 ? Math.floor(horizonDays) : 14;
    const today = chinaToday();

    const templates = await bookingRepository.listEnabledTemplates();
    if (templates.length === 0) {
      return ok({ created: 0, candidates: 0, days, closedDays: 0 });
    }

    const fromDb = new Date(`${today}T00:00:00Z`);
    const toDb = new Date(`${addDays(today, days - 1)}T00:00:00Z`);
    const overrides = new Map(
      (await bookingRepository.listHolidayCalendar(fromDb, toDb)).map((h) => [
        h.date.toISOString().slice(0, 10),
        h,
      ]),
    );

    const rows: Prisma.BookingSlotCreateManyInput[] = [];
    let closedDays = 0;

    for (let offset = 0; offset < days; offset++) {
      const dateStr = addDays(today, offset);
      const ov = overrides.get(dateStr);
      if (ov?.closed) {
        closedDays++;
        continue;
      }
      const dayType = inferDayType(dateStr, ov?.dayType);
      const date = new Date(`${dateStr}T00:00:00Z`);
      for (const t of templates) {
        if (t.dayType !== dayType) continue;
        const capacity = t.miniProgramQuota + t.onsiteQuota + t.otaQuota + t.adminQuota;
        rows.push({
          date,
          name: t.name,
          startTime: t.startTime,
          endTime: t.endTime,
          capacity,
          miniProgramQuota: t.miniProgramQuota,
          onsiteQuota: t.onsiteQuota,
          otaQuota: t.otaQuota,
          adminQuota: t.adminQuota,
          status: "ACTIVE",
        });
      }
    }

    // 幂等:ON CONFLICT (date,start_time) DO NOTHING,绝不覆盖运营手调过的已存在时段。
    const created = rows.length ? await bookingRepository.createManySlotsIdempotent(rows) : 0;
    return ok({ created, candidates: rows.length, days, closedDays });
  },
};

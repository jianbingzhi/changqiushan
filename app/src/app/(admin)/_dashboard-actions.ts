"use server";

import { bookingService } from "@/modules/booking";
import { chinaToday } from "@/shared/lib/time";

// C3 在园数「脏信号 + 回拉」:前端收到 checkin_event 后回拉本接口取最新在园数,
// 绕开触发器/服务两路 NOTIFY payload 形状差异(§0.B.3)。返回今日各时段在园数之和。
// T4: 与全站读口径统一走派生合并视图(派生行 checkedIn 恒 0,数值不变)。
export async function getOccupancySnapshot(): Promise<number> {
  const slots = await bookingService.listSlotsForDate(chinaToday()).catch(() => []);
  return slots.reduce((sum, s) => sum + s.checkedInCount, 0);
}

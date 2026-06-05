"use server";

import { bookingRepository } from "@/modules/booking";
import { chinaTodayDbDate } from "@/shared/lib/time";

// C6 大屏在园数:与 C3 同一「脏信号 + 回拉」方案 —— 大屏收到 checkin_event 后回拉此接口
// 取今日各时段在园数之和,不依赖事件 payload 形状。
export async function getScreenOccupancy(): Promise<number> {
  const slots = await bookingRepository.listSlotsByDate(chinaTodayDbDate()).catch(() => []);
  return slots.reduce((sum, s) => sum + s.checkedInCount, 0);
}

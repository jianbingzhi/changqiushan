"use server";

import { bookingRepository } from "@/modules/booking";

// C3 在园数「脏信号 + 回拉」:前端收到 checkin_event 后回拉本接口取最新在园数,
// 绕开触发器/服务两路 NOTIFY payload 形状差异(§0.B.3)。返回今日各时段在园数之和。
export async function getOccupancySnapshot(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const slots = await bookingRepository.listSlotsByDate(today).catch(() => []);
  return slots.reduce((sum, s) => sum + s.checkedInCount, 0);
}

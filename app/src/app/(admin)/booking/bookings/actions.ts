"use server";

import { revalidatePath } from "next/cache";
import { checkinService } from "@/modules/checkin";
import { getSession } from "@/infrastructure/auth/session";

export type CheckinActionResult = { ok: boolean; message: string };

/** 3.5: B22 后台手动核销 — 经 app 层组合 checkinService(幂等),按预约单二维码核销 */
export async function checkinBooking(qrCode: string): Promise<CheckinActionResult> {
  const session = await getSession();
  const result = await checkinService.checkin(qrCode, session?.userId);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/booking/bookings");
  return { ok: true, message: "核销成功" };
}

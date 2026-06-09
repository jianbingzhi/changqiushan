"use server";

import { revalidatePath } from "next/cache";
import { requireRole, ADMIN_UP } from "@/infrastructure/auth/guard";
import { channelService } from "@/modules/booking";

export type ChannelActionResult = { ok: boolean; message: string };

export interface ChannelPayload {
  label: string;
  description: string;
  sortOrder: number;
}

export async function saveChannelAction(code: string, payload: ChannelPayload): Promise<ChannelActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const res = await channelService.update(code, payload);
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/booking/channels");
  return { ok: true, message: "已保存渠道配置" };
}

export async function toggleChannelAction(code: string, enabled: boolean): Promise<ChannelActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const res = await channelService.setEnabled(code, enabled);
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/booking/channels");
  return { ok: true, message: enabled ? "已启用该渠道" : "已停用该渠道" };
}

"use server";

import { revalidatePath } from "next/cache";
import { requireRole, ADMIN_UP } from "@/infrastructure/auth/guard";
import { iotService } from "@/modules/iot";

export type DeviceActionResult = { ok: boolean; message: string };

export interface DevicePayload {
  id?: string;
  name: string;
  type: string;
  location?: string;
}

export async function saveDeviceAction(payload: DevicePayload): Promise<DeviceActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const input = { name: payload.name, type: payload.type, location: payload.location };
  const res = payload.id
    ? await iotService.updateDevice(payload.id, input)
    : await iotService.createDevice(input);
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/iot/devices");
  return { ok: true, message: payload.id ? "已保存设备修改" : `已新建设备「${res.value.name}」` };
}

export async function deleteDeviceAction(id: string): Promise<DeviceActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const res = await iotService.deleteDevice(id);
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/iot/devices");
  return { ok: true, message: "已删除设备(含其历史心跳记录)" };
}

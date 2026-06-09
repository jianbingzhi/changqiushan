"use server";

import { revalidatePath } from "next/cache";
import { requireRole, ADMIN_UP } from "@/infrastructure/auth/guard";
import { trafficService } from "@/modules/traffic";

export type ParkingActionResult = { ok: boolean; message: string };

export interface ParkingLotPayload {
  id?: string;
  name: string;
  capacity: number;
  status: "OPEN" | "FULL" | "CLOSED";
  location?: string;
  coordinates?: { lng: number; lat: number } | null;
}

export async function saveParkingLotAction(payload: ParkingLotPayload): Promise<ParkingActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const input = {
    name: payload.name,
    capacity: payload.capacity,
    status: payload.status,
    location: payload.location,
    coordinates: payload.coordinates ?? null,
  };
  const res = payload.id
    ? await trafficService.updateParkingLot(payload.id, input)
    : await trafficService.createParkingLot(input);
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/traffic/parking");
  return { ok: true, message: payload.id ? "已保存停车场修改" : `已新建停车场「${res.value.name}」` };
}

export async function deleteParkingLotAction(id: string): Promise<ParkingActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const res = await trafficService.deleteParkingLot(id);
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/traffic/parking");
  return { ok: true, message: "已删除停车场" };
}

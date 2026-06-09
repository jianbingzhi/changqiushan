import { Prisma } from "@prisma/client";
import type { TrafficParkingLot } from "@prisma/client";
import { bus } from "@/infrastructure/realtime/bus";
import { ok, err, ErrCode, type Result } from "@/shared/result";
import { getParkingStatus } from "../domain/rules";
import { createParkingLotSchema, updateParkingLotSchema } from "../domain/schema";
import { trafficRepository } from "../repository";

// coordinates 列是 Json?:null 入库须用 Prisma.JsonNull(写 JSON null),undefined/缺省走 DbNull(不写)。
const toJsonCoord = (c: { lng: number; lat: number } | null | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  c ? { lng: c.lng, lat: c.lat } : Prisma.JsonNull;

const isUniqueConflict = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
const isNotFound = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";

export const trafficService = {
  async syncParkingStatus(lotId: string, occupied: number): Promise<void> {
    const lot = await trafficRepository.getParkingLot(lotId);
    if (!lot) throw new Error(`Parking lot ${lotId} not found`);

    const status = getParkingStatus(occupied, lot.capacity);
    await trafficRepository.updateParkingStatus(lotId, { occupied, status });

    bus.publish("parking_state", {
      lotId, name: lot.name, occupied, capacity: lot.capacity, status,
    });
  },

  listParkingLots() {
    return trafficRepository.listParkingLots();
  },

  // B33③ 新建停车场。occupied 不开放,恒为 0;status 默认 OPEN。
  async createParkingLot(raw: unknown): Promise<Result<TrafficParkingLot>> {
    const parsed = createParkingLotSchema.safeParse(raw);
    if (!parsed.success) {
      return err(ErrCode.INVALID_INPUT, parsed.error.issues[0]?.message ?? "输入校验失败");
    }
    const { name, capacity, status, location, coordinates } = parsed.data;
    try {
      const lot = await trafficRepository.createParkingLot({
        name,
        capacity,
        occupied: 0,
        status,
        location: location ?? null,
        coordinates: toJsonCoord(coordinates),
      });
      return ok(lot);
    } catch (e) {
      if (isUniqueConflict(e)) return err(ErrCode.CONFLICT, "已存在同名停车场");
      throw e;
    }
  },

  async updateParkingLot(id: string, raw: unknown): Promise<Result<TrafficParkingLot>> {
    const parsed = updateParkingLotSchema.safeParse(raw);
    if (!parsed.success) {
      return err(ErrCode.INVALID_INPUT, parsed.error.issues[0]?.message ?? "输入校验失败");
    }
    const { name, capacity, status, location, coordinates } = parsed.data;
    try {
      const lot = await trafficRepository.updateParkingLot(id, {
        name,
        capacity,
        status,
        location: location ?? null,
        coordinates: toJsonCoord(coordinates),
      });
      return ok(lot);
    } catch (e) {
      if (isUniqueConflict(e)) return err(ErrCode.CONFLICT, "已存在同名停车场");
      if (isNotFound(e)) return err(ErrCode.NOT_FOUND, "停车场不存在");
      throw e;
    }
  },

  // 停车场无下游依赖表(occupied 为同列动态值,无外键引用),可直接删除。
  async deleteParkingLot(id: string): Promise<Result<void>> {
    try {
      await trafficRepository.deleteParkingLot(id);
      return ok(undefined);
    } catch (e) {
      if (isNotFound(e)) return err(ErrCode.NOT_FOUND, "停车场不存在");
      throw e;
    }
  },
};

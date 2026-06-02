import { db } from "@/infrastructure/db/client";
import type { DeviceStatus, Prisma } from "@prisma/client";

export const iotRepository = {
  listDevices() {
    return db.iotDevice.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] });
  },

  getDevice(id: string) {
    return db.iotDevice.findUnique({ where: { id } });
  },

  updateDeviceStatus(id: string, data: { status?: DeviceStatus; lastSeen?: Date }) {
    return db.iotDevice.update({ where: { id }, data });
  },

  upsertDevice(data: Prisma.IotDeviceCreateInput) {
    return db.iotDevice.upsert({
      where: { name: data.name },
      create: data,
      update: { type: data.type, location: data.location ?? null, metadata: data.metadata },
    });
  },

  addHeartbeat(data: {
    deviceId:       string;
    latency:        number;
    packetLoss:     number;
    signalStrength?: number;
    recordedAt:     Date;
  }) {
    return db.iotHeartbeat.create({ data });
  },

  getRecentHeartbeats(deviceId: string, limit = 50) {
    return db.iotHeartbeat.findMany({
      where: { deviceId },
      orderBy: { recordedAt: "desc" },
      take: limit,
    });
  },

  // DB 层过滤超时设备,排除已离线的(避免重复 bus.publish)
  findStaleDevices(cutoff: Date) {
    return db.iotDevice.findMany({
      where: {
        OR: [{ lastSeen: null }, { lastSeen: { lt: cutoff } }],
        status: { not: "OFFLINE" },
      },
    });
  },
};

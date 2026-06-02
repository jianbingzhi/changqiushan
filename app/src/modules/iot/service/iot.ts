import { bus } from "@/infrastructure/realtime/bus";
import { ok, err, ErrCode, type Result } from "@/shared/result";
import { HEARTBEAT_TIMEOUT_MS } from "../domain/rules";
import { iotRepository } from "../repository";
import { IOT_EVENT_CHANNEL, type IotEventPayload } from "../events";
import type { IotDevice } from "@prisma/client";

export const iotService = {
  async recordHeartbeat(
    deviceId: string,
    data: { latency: number; packetLoss: number; signalStrength?: number },
  ): Promise<Result<void>> {
    const device = await iotRepository.getDevice(deviceId);
    if (!device) return err(ErrCode.NOT_FOUND, `设备不存在: ${deviceId}`);

    const now = new Date();
    await iotRepository.addHeartbeat({ ...data, deviceId, recordedAt: now });
    await iotRepository.updateDeviceStatus(deviceId, { status: "ONLINE", lastSeen: now });

    const payload: IotEventPayload = {
      deviceId, name: device.name, ...data, status: "ONLINE", recordedAt: now.toISOString(),
    };
    bus.publish(IOT_EVENT_CHANNEL, payload);
    return ok(undefined);
  },

  async scanOfflineDevices(): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - HEARTBEAT_TIMEOUT_MS);
    const stale = await iotRepository.findStaleDevices(cutoff);
    if (stale.length === 0) return;

    await Promise.all(
      stale.map(async (device) => {
        await iotRepository.updateDeviceStatus(device.id, { status: "OFFLINE" });
        bus.publish(IOT_EVENT_CHANNEL, {
          deviceId: device.id, name: device.name, status: "OFFLINE",
          recordedAt: now.toISOString(),
        } as IotEventPayload);
      }),
    );
  },

  listDevices() { return iotRepository.listDevices(); },

  async getDeviceWithHeartbeats(id: string, limit = 50): Promise<{ device: IotDevice; heartbeats: Awaited<ReturnType<typeof iotRepository.getRecentHeartbeats>> } | null> {
    const device = await iotRepository.getDevice(id);
    if (!device) return null;
    const heartbeats = await iotRepository.getRecentHeartbeats(id, limit);
    return { device, heartbeats };
  },
};

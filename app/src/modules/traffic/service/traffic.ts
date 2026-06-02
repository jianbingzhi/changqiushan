import { bus } from "@/infrastructure/realtime/bus";
import { getParkingStatus } from "../domain/rules";
import { trafficRepository } from "../repository";

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
};

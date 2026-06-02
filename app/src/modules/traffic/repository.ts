import { db } from "@/infrastructure/db/client";
import type { ParkingStatus } from "@prisma/client";

export const trafficRepository = {
  listParkingLots() { return db.trafficParkingLot.findMany({ orderBy: { name: "asc" } }); },
  getParkingLot(id: string) { return db.trafficParkingLot.findUnique({ where: { id } }); },
  updateParkingStatus(id: string, data: { occupied?: number; status?: ParkingStatus }) {
    return db.trafficParkingLot.update({ where: { id }, data });
  },
};

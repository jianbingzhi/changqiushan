import { db } from "@/infrastructure/db/client";
import type { Prisma, ParkingStatus } from "@prisma/client";

export const trafficRepository = {
  listParkingLots() { return db.trafficParkingLot.findMany({ orderBy: { name: "asc" } }); },
  getParkingLot(id: string) { return db.trafficParkingLot.findUnique({ where: { id } }); },
  updateParkingStatus(id: string, data: { occupied?: number; status?: ParkingStatus }) {
    return db.trafficParkingLot.update({ where: { id }, data });
  },
  createParkingLot(data: Prisma.TrafficParkingLotCreateInput) {
    return db.trafficParkingLot.create({ data });
  },
  updateParkingLot(id: string, data: Prisma.TrafficParkingLotUpdateInput) {
    return db.trafficParkingLot.update({ where: { id }, data });
  },
  deleteParkingLot(id: string) {
    return db.trafficParkingLot.delete({ where: { id } });
  },
};

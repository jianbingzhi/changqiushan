export { trafficService } from "./service/traffic";
export { trafficRepository } from "./repository";
export { PARKING_STATE_CHANNEL } from "./events";
export type { ParkingStatePayload } from "./events";
export type { CreateParkingLotInput, UpdateParkingLotInput } from "./domain/schema";
export type { TrafficParkingLot, ParkingStatus } from "@prisma/client";

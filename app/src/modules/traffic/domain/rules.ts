import type { ParkingStatus } from "@prisma/client";

export function isParkingFull(occupied: number, capacity: number): boolean {
  return capacity > 0 && occupied >= capacity;
}

export function getParkingStatus(occupied: number, capacity: number): ParkingStatus {
  if (capacity <= 0) return "OPEN";
  return occupied >= capacity ? "FULL" : "OPEN";
}

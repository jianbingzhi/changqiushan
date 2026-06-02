export const PARKING_STATE_CHANNEL = "parking_state" as const;

export interface ParkingStatePayload {
  lotId:     string;
  name:      string;
  occupied:  number;
  capacity:  number;
  status:    "OPEN" | "FULL" | "CLOSED";
  updatedAt: string;
}

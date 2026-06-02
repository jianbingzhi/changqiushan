export const IOT_EVENT_CHANNEL = "iot_event" as const;

export interface IotEventPayload {
  deviceId:        string;
  name:            string;
  latency?:        number;
  packetLoss?:     number;
  signalStrength?: number;
  status:          "ONLINE" | "OFFLINE" | "ALERT";
  recordedAt:      string;
}

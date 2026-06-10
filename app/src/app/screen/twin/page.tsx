import { iotRepository } from "@/modules/iot";
import { trafficRepository } from "@/modules/traffic";
import { contentRepository } from "@/modules/content";
import { bookingService } from "@/modules/booking";
import { configService } from "@/modules/system";
import { resolveInstantCapacity, CIRCUIT_BREAK_RATIO } from "@/shared/lib/capacity";
import { chinaToday } from "@/shared/lib/time";
import { ScreenShell } from "@/lib/ui/screen/ScreenShell";
import { TwinLive, type TwinData } from "./_twin-live";

export const dynamic = "force-dynamic";
export const metadata = { title: "数字孪生导览图 · 长秋山森林公园智慧景区" };

export default async function TwinScreenPage() {
  const [devices, lots, pois, slots, capacity] = await Promise.all([
    iotRepository.listDevices().catch(() => []),
    trafficRepository.listParkingLots().catch(() => []),
    contentRepository.listPois().catch(() => []),
    bookingService.listSlotsForDate(chinaToday()).catch(() => []),
    configService.getInstantCapacity().catch(() => resolveInstantCapacity()),
  ]);

  const checkedIn = slots.reduce((s, sl) => s + sl.checkedInCount, 0);
  const bookings = slots.reduce((s, sl) => s + sl.bookedCount, 0);
  const pct = capacity > 0 ? Math.round((checkedIn / capacity) * 100) : 0;

  const online = devices.filter((d) => d.status === "ONLINE").length;
  const deviceOnlineRate = devices.length > 0 ? Math.round((online / devices.length) * 100) : 0;

  const parkCapacity = lots.reduce((s, l) => s + l.capacity, 0);
  const parkOccupied = lots.reduce((s, l) => s + l.occupied, 0);
  const parkingLoad = parkCapacity > 0 ? Math.round((parkOccupied / parkCapacity) * 100) : 0;

  const publishedPois = pois.filter((p) => p.status === "PUBLISHED");
  const poiViews = publishedPois.map((p) => ({
    name: p.name,
    category: p.category,
    lat: Number(p.latitude),
    lng: Number(p.longitude),
  }));
  const categories = [...new Set(publishedPois.map((p) => p.category))];
  const center =
    poiViews.length > 0
      ? {
          lat: poiViews.reduce((s, p) => s + p.lat, 0) / poiViews.length,
          lng: poiViews.reduce((s, p) => s + p.lng, 0) / poiViews.length,
        }
      : null;

  const data: TwinData = {
    occupancy: {
      occupancy: checkedIn,
      capacity,
      bookings,
      pct,
      circuitBroken: pct >= CIRCUIT_BREAK_RATIO * 100,
      paused: slots.some((s) => s.status === "PAUSED"),
    },
    checkedIn,
    device: {
      total: devices.length,
      online,
      alert: devices.filter((d) => d.status === "ALERT").length,
      offline: devices.filter((d) => d.status === "OFFLINE").length,
    },
    deviceOnlineRate,
    parkingLoad,
    openAreas: { open: publishedPois.length, total: pois.length },
    alerts: devices
      .filter((d) => d.status === "ALERT" || d.status === "OFFLINE")
      .map((d) => ({ name: d.name, location: d.location, status: d.status })),
    pois: poiViews,
    categories,
    center,
  };

  return (
    <ScreenShell>
      <TwinLive data={data} />
    </ScreenShell>
  );
}

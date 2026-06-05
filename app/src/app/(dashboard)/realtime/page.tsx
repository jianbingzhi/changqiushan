import { bookingRepository } from "@/modules/booking";
import { iotRepository } from "@/modules/iot";
import { trafficRepository } from "@/modules/traffic";
import { analyticsRepository } from "@/modules/analytics";
import { getInstantCapacity } from "@/shared/lib/capacity";
import { BigScreen, type SlotOccupancy, type ParkingLotView } from "./_big-screen";
import type { BarDatum } from "@/lib/ui/charts/BarList";

export const dynamic = "force-dynamic";
export const metadata = { title: "实时数据大屏 · 长秋山森林公园智慧景区" };

export default async function RealtimeScreenPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6); // 近 7 日(含今日)

  const [slots, devices, lots, daily] = await Promise.all([
    bookingRepository.listSlotsByDate(today).catch(() => []),
    iotRepository.listDevices().catch(() => []),
    trafficRepository.listParkingLots().catch(() => []),
    analyticsRepository.getDailyTraffic(start, end).catch(() => []),
  ]);

  const todayBookings = slots.reduce((s, sl) => s + sl.bookedCount, 0);
  const initialOccupancy = slots.reduce((s, sl) => s + sl.checkedInCount, 0);

  const device = {
    total: devices.length,
    online: devices.filter((d) => d.status === "ONLINE").length,
    alert: devices.filter((d) => d.status === "ALERT").length,
    offline: devices.filter((d) => d.status === "OFFLINE").length,
  };

  const slotViews: SlotOccupancy[] = slots.map((s) => ({
    name: s.name,
    start: s.startTime,
    end: s.endTime,
    checkedIn: s.checkedInCount,
    capacity: s.capacity,
  }));

  const parkingViews: ParkingLotView[] = lots.map((l) => ({
    name: l.name,
    capacity: l.capacity,
    occupied: l.occupied,
    status: l.status,
  }));

  // 日历日串 YYYY-MM-DD → 「M月D日」短标签(不在 UI 露出 ISO 格式)
  const dailyTraffic: BarDatum[] = daily.map((r) => {
    const [, m, d] = r.date.split("-");
    return { label: `${Number(m)}月${Number(d)}日`, value: Number(r.total_visitors) };
  });

  return (
    <BigScreen
      scenicName="长秋山森林公园"
      instantCapacity={getInstantCapacity()}
      initialOccupancy={initialOccupancy}
      todayBookings={todayBookings}
      device={device}
      slots={slotViews}
      dailyTraffic={dailyTraffic}
      parkingLots={parkingViews}
    />
  );
}

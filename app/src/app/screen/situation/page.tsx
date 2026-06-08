import { bookingRepository } from "@/modules/booking";
import { iotRepository } from "@/modules/iot";
import { contentRepository } from "@/modules/content";
import { analyticsRepository } from "@/modules/analytics";
import { configService } from "@/modules/system";
import { resolveInstantCapacity, CIRCUIT_BREAK_RATIO } from "@/shared/lib/capacity";
import { chinaTodayDbDate } from "@/shared/lib/time";
import { ScreenShell } from "@/lib/ui/screen/ScreenShell";
import { SituationLive, type SituationData } from "./_situation-live";

export const dynamic = "force-dynamic";
export const metadata = { title: "综合态势主屏 · 长秋山森林公园智慧景区" };

const N = (v: bigint | number) => Number(v);
const CHANNEL_CN: Record<string, string> = {
  MINI_PROGRAM: "小程序",
  ONSITE_MAKEUP: "现场补录",
  OTA: "OTA 渠道",
  ADMIN_MANUAL: "后台补录",
};

export default async function SituationScreenPage() {
  const today = chinaTodayDbDate();
  const [slots, capacity, devices, profile, source, activities, pois] = await Promise.all([
    bookingRepository.listSlotsByDate(today).catch(() => []),
    configService.getInstantCapacity().catch(() => resolveInstantCapacity()),
    iotRepository.listDevices().catch(() => []),
    analyticsRepository.getProfileOverview().catch(() => []),
    analyticsRepository.getVisitorSource().catch(() => []),
    contentRepository.listActivitiesWithCounts().catch(() => []),
    contentRepository.listPois().catch(() => []),
  ]);

  const bookings = slots.reduce((s, sl) => s + sl.bookedCount, 0);
  const checkedIn = slots.reduce((s, sl) => s + sl.checkedInCount, 0);
  const pct = capacity > 0 ? Math.round((checkedIn / capacity) * 100) : 0;

  const men = N(profile.find((r) => r.dimension === "性别·男")?.value ?? 0);
  const women = N(profile.find((r) => r.dimension === "性别·女")?.value ?? 0);
  const ageBars = profile
    .filter((r) => r.dimension.startsWith("年龄·"))
    .map((r) => ({ label: r.dimension.replace("年龄·", ""), value: N(r.value), hint: `${r.percentage}%` }));

  const channels = source.map((r) => ({ name: CHANNEL_CN[r.source_channel] ?? r.source_channel, value: N(r.visitor_count) }));

  const now = new Date().getTime();
  const activitiesCn = activities
    .filter((a) => a.status === "PUBLISHED")
    .map((a) => ({
      title: a.title,
      statusCn: +a.startDate > now ? "报名中" : +a.endDate >= now ? "进行中" : "已结束",
      signups: a._count.signups,
      max: a.maxParticipants,
    }))
    .filter((a) => a.statusCn !== "已结束")
    .slice(0, 4);

  const poiViews = pois
    .filter((p) => p.status === "PUBLISHED")
    .map((p) => ({ name: p.name, category: p.category, lat: Number(p.latitude), lng: Number(p.longitude) }));

  const data: SituationData = {
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
      online: devices.filter((d) => d.status === "ONLINE").length,
      alert: devices.filter((d) => d.status === "ALERT").length,
      offline: devices.filter((d) => d.status === "OFFLINE").length,
    },
    alerts: devices
      .filter((d) => d.status === "ALERT" || d.status === "OFFLINE")
      .map((d) => ({ name: d.name, location: d.location, status: d.status })),
    gender: { men, women },
    ageBars,
    channels,
    activities: activitiesCn,
    pois: poiViews,
  };

  return (
    <ScreenShell>
      <SituationLive data={data} />
    </ScreenShell>
  );
}

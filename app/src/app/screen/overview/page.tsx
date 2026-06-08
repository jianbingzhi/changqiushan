import { bookingRepository } from "@/modules/booking";
import { trafficRepository } from "@/modules/traffic";
import { iotRepository } from "@/modules/iot";
import { contentRepository } from "@/modules/content";
import { analyticsRepository } from "@/modules/analytics";
import { configService } from "@/modules/system";
import { resolveInstantCapacity } from "@/shared/lib/capacity";
import { chinaTodayDbDate, toCstDateStr } from "@/shared/lib/time";
import { ScreenShell } from "@/lib/ui/screen/ScreenShell";
import { ScreenHeader } from "@/lib/ui/screen/ScreenHeader";
import { ScreenCard } from "@/lib/ui/screen/ScreenCard";
import { KpiTile } from "@/lib/ui/screen/KpiTile";
import { DarkBarList } from "@/lib/ui/screen/DarkBarList";
import { PlaceholderTag } from "@/lib/ui/screen/PlaceholderTag";
import { DonutChart } from "@/lib/ui/screen/charts/DonutChart";
import { RadarChart } from "@/lib/ui/screen/charts/RadarChart";
import { OverviewOccupancy } from "./_overview-occupancy";

export const dynamic = "force-dynamic";
export const metadata = { title: "数据概览首屏 · 长秋山森林公园智慧景区" };

function num(v: bigint | number | null | undefined): number {
  return v == null ? 0 : Number(v);
}
function dateStrOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toCstDateStr(d);
}
function profileValue(rows: { dimension: string; value: bigint }[], dim: string): number {
  return num(rows.find((r) => r.dimension === dim)?.value);
}

export default async function OverviewScreenPage() {
  const today = chinaTodayDbDate();
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 371);

  const [slots, capacity, lots, activities, devices, profile, preference, daily] = await Promise.all([
    bookingRepository.listSlotsByDate(today).catch(() => []),
    configService.getInstantCapacity().catch(() => resolveInstantCapacity()),
    trafficRepository.listParkingLots().catch(() => []),
    contentRepository.listActivitiesWithCounts().catch(() => []),
    iotRepository.listDevices().catch(() => []),
    analyticsRepository.getProfileOverview().catch(() => []),
    analyticsRepository.getTravelPreference().catch(() => []),
    analyticsRepository.getDailyTraffic(rangeStart, new Date()).catch(() => []),
  ]);

  // —— KPI 派生 ——
  const bookings = slots.reduce((s, sl) => s + sl.bookedCount, 0);
  const checkedIn = slots.reduce((s, sl) => s + sl.checkedInCount, 0);
  const remaining = slots.reduce((s, sl) => s + Math.max(0, sl.capacity - sl.bookedCount), 0);
  const slotsFull = slots.filter((sl) => sl.bookedCount >= sl.capacity).length;
  const fulfillRate = bookings > 0 ? Math.round((checkedIn / bookings) * 1000) / 10 : 0;
  const capacityPct = capacity > 0 ? Math.round((checkedIn / capacity) * 100) : 0;

  const parkCapacity = lots.reduce((s, l) => s + l.capacity, 0);
  const parkOccupied = lots.reduce((s, l) => s + l.occupied, 0);
  const parkRemaining = Math.max(0, parkCapacity - parkOccupied);
  const parkUsage = parkCapacity > 0 ? Math.round((parkOccupied / parkCapacity) * 100) : 0;

  const now = new Date().getTime();
  const published = activities.filter((a) => a.status === "PUBLISHED");
  const ongoing = published.filter((a) => +a.startDate <= now && +a.endDate >= now).length;
  const registering = published.filter((a) => +a.startDate > now).length;

  const alertCount = devices.filter((d) => d.status === "ALERT").length;
  const offlineCount = devices.filter((d) => d.status === "OFFLINE").length;

  // —— 画像 ——
  const men = profileValue(profile, "性别·男");
  const women = profileValue(profile, "性别·女");
  const ageBars = profile
    .filter((r) => r.dimension.startsWith("年龄·"))
    .map((r) => ({ label: r.dimension.replace("年龄·", ""), value: num(r.value), hint: `${r.percentage}%` }));
  const prefRadarRows = preference.filter((r) => r.dimension.startsWith("时段·") || r.dimension === "出行·自驾");
  const prefIndicators = prefRadarRows.map((r) => ({ name: r.dimension.replace("·", " "), max: 100 }));
  const prefValues = prefRadarRows.map((r) => r.percentage);

  // —— 同期对比(入园人数) ——
  const dailyMap = new Map(daily.map((r) => [r.date, num(r.checked_in_count)]));
  const todayMetric = checkedIn;
  const compare = (label: string, days: number) => {
    const base = dailyMap.get(dateStrOffset(days));
    if (base == null || base === 0) return { label, text: "暂无基期", up: undefined as boolean | undefined };
    const delta = Math.round(((todayMetric - base) / base) * 1000) / 10;
    return { label, text: `${delta >= 0 ? "+" : ""}${delta}%`, up: delta >= 0 };
  };
  const comparisons = [
    compare("与昨日对比", 1),
    compare("与上周同期", 7),
    compare("与上月同期", 30),
    compare("与去年同期", 365),
  ];

  return (
    <ScreenShell>
      <div className="flex h-full flex-col">
        <ScreenHeader
          title="长秋山森林公园 · 数据概览首屏"
          rightExtra={
            <span className="flex items-center gap-2 text-[14px]" style={{ color: "var(--screen-text-dim)" }}>
              <PlaceholderTag text="天气/AQI 待接入" />
            </span>
          }
        />

        <div className="flex flex-1 flex-col gap-4 p-6">
          {/* 8 KPI 卡片(2×4) */}
          <section className="grid grid-cols-4 gap-4">
            <KpiTile
              title="今日累计预约人数"
              value={bookings.toLocaleString("zh-CN")}
              unit="人次"
              valueSize={44}
              sub={`共 ${slots.length} 个时段`}
            />
            <KpiTile
              title="今日累计入园核销"
              value={checkedIn.toLocaleString("zh-CN")}
              unit="人次"
              valueSize={44}
              tone="highlight"
              sub={`履约率 ${fulfillRate}%`}
            />
            <OverviewOccupancy
              initial={{ occupancy: checkedIn, capacity, pct: capacityPct }}
            />
            <KpiTile
              title="今日剩余可预约名额"
              value={remaining.toLocaleString("zh-CN")}
              unit="个"
              valueSize={44}
              sub={`${slots.length} 时段中 ${slotsFull} 个已满`}
            />
            <KpiTile
              title="停车场总余量"
              value={parkRemaining.toLocaleString("zh-CN")}
              unit="位"
              valueSize={44}
              sub={`${lots.length} 个停车场 / 使用率 ${parkUsage}%`}
            />
            <KpiTile
              title="实时天气 / 空气质量"
              value="—"
              valueSize={44}
              tone="highlight"
              sub={<PlaceholderTag text="外部气象 API 待接入" />}
            />
            <KpiTile
              title="当日活动开展"
              value={String(ongoing + registering)}
              unit="个"
              valueSize={44}
              sub={`报名中 ${registering} 个 / 进行中 ${ongoing} 个`}
            />
            <KpiTile
              title="今日告警事件"
              value={String(alertCount)}
              unit="起"
              valueSize={44}
              tone="warn"
              danger={alertCount > 0}
              sub={`告警 ${alertCount} / 离线 ${offlineCount}`}
            />
          </section>

          {/* 画像快照(大屏固定画布:图表给确定 px 高度,不依赖多层 flex 解析 100% 高) */}
          <ScreenCard title="当前在园游客画像快照" className="flex-1">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="mb-1 text-[14px]" style={{ color: "var(--screen-text-dim)" }}>性别比例</p>
                <DonutChart
                  height={240}
                  data={[
                    { name: "男", value: men },
                    { name: "女", value: women },
                  ]}
                  centerValue={`${men + women}`}
                  centerLabel="抽样人数"
                />
              </div>
              <div>
                <p className="mb-2 text-[14px]" style={{ color: "var(--screen-text-dim)" }}>年龄段分布</p>
                <div style={{ height: 240 }}>
                  <DarkBarList data={ageBars} emptyText="暂无画像数据" />
                </div>
              </div>
              <div>
                <p className="mb-1 text-[14px]" style={{ color: "var(--screen-text-dim)" }}>在园游客出行偏好</p>
                {prefIndicators.length > 0 ? (
                  <RadarChart height={240} indicators={prefIndicators} series={[{ name: "出行偏好", values: prefValues }]} />
                ) : (
                  <div className="flex items-center justify-center text-[14px]" style={{ height: 240, color: "var(--screen-text-faint)" }}>
                    暂无偏好数据
                  </div>
                )}
              </div>
            </div>
            <p className="mt-1 text-[12px]" style={{ color: "var(--screen-text-faint)" }}>
              注：本/外区县·市·省占比需行政区划码表，<PlaceholderTag text="地域画像待接入" />
            </p>
          </ScreenCard>

          {/* 同期对比 */}
          <section className="grid grid-cols-4 gap-4">
            {comparisons.map((c) => (
              <div
                key={c.label}
                className="flex items-center justify-between rounded-lg px-5 py-4"
                style={{ backgroundColor: "var(--screen-card-bg)", border: "1px solid var(--screen-card-border)" }}
              >
                <span className="text-[15px]" style={{ color: "var(--screen-text-dim)" }}>{c.label}</span>
                <span
                  className="text-[28px] font-bold tabular-nums"
                  style={{
                    color:
                      c.up === undefined
                        ? "var(--screen-text-faint)"
                        : c.up
                          ? "var(--screen-glow)"
                          : "var(--screen-orange)",
                  }}
                >
                  {c.up === undefined ? c.text : `${c.up ? "↑" : "↓"} ${c.text}`}
                </span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </ScreenShell>
  );
}

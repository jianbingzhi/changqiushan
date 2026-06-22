import { bookingService } from "@/modules/booking";
import { analyticsRepository } from "@/modules/analytics";
import { contentRepository } from "@/modules/content";
import { iotRepository } from "@/modules/iot";
import { trafficRepository } from "@/modules/traffic";
import { configService } from "@/modules/system";
import { CIRCUIT_BREAK_RATIO, resolveInstantCapacity } from "@/shared/lib/capacity";
import { chinaToday } from "@/shared/lib/time";
import { ScreenShell } from "@/lib/ui/screen/ScreenShell";
import { ScreenHeader } from "@/lib/ui/screen/ScreenHeader";
import { ScreenCard } from "@/lib/ui/screen/ScreenCard";
import { KpiTile } from "@/lib/ui/screen/KpiTile";
import { DarkBarList } from "@/lib/ui/screen/DarkBarList";
import { PlaceholderTag } from "@/lib/ui/screen/PlaceholderTag";
import { DonutChart } from "@/lib/ui/screen/charts/DonutChart";
import { GaugeRing } from "@/lib/ui/screen/charts/GaugeRing";
import { Heatmap724 } from "@/lib/ui/screen/charts/Heatmap724";
import { LineTrend } from "@/lib/ui/screen/charts/LineTrend";
import { StackedBar } from "@/lib/ui/screen/charts/StackedBar";
import { ULTRAWIDE_SCREEN_SIZE } from "@/lib/ui/screen/use-screen-scale";
import { AmapContainer } from "@/lib/ui/map/AmapContainer";

export const dynamic = "force-dynamic";
export const metadata = { title: "超宽融合指挥总屏 · 长秋山森林公园智慧景区" };

const N = (v: bigint | number | null | undefined) => (v == null ? 0 : Number(v));

function cnDate(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

const CHANNEL_CN: Record<string, string> = {
  MINI_PROGRAM: "小程序",
  ONSITE_MAKEUP: "现场补录",
  OTA: "OTA 渠道",
  ADMIN_MANUAL: "后台补录",
};

export default async function CommandScreenPage() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 13);

  const [slots, capacity, daily, heat, devices, lots, pois, profile, source, activities] = await Promise.all([
    bookingService.listSlotsForDate(chinaToday()).catch(() => []),
    configService.getInstantCapacity().catch(() => resolveInstantCapacity()),
    analyticsRepository.getDailyTraffic(start, end).catch(() => []),
    analyticsRepository.getWeeklyHourlyHeat().catch(() => []),
    iotRepository.listDevices().catch(() => []),
    trafficRepository.listParkingLots().catch(() => []),
    contentRepository.listPois().catch(() => []),
    analyticsRepository.getProfileOverview().catch(() => []),
    analyticsRepository.getVisitorSource().catch(() => []),
    contentRepository.listActivitiesWithCounts().catch(() => []),
  ]);

  const bookings = slots.reduce((s, sl) => s + sl.bookedCount, 0);
  const checkedIn = slots.reduce((s, sl) => s + sl.checkedInCount, 0);
  const remaining = slots.reduce((s, sl) => s + Math.max(0, sl.capacity - sl.bookedCount), 0);
  const capacityPct = capacity > 0 ? Math.round((checkedIn / capacity) * 100) : 0;
  const warn = capacityPct >= CIRCUIT_BREAK_RATIO * 100;
  const fulfillRate = bookings > 0 ? Math.round((checkedIn / bookings) * 1000) / 10 : 0;

  const parkCapacity = lots.reduce((s, l) => s + l.capacity, 0);
  const parkOccupied = lots.reduce((s, l) => s + l.occupied, 0);
  const parkingLoad = parkCapacity > 0 ? Math.round((parkOccupied / parkCapacity) * 100) : 0;
  const deviceOnlineRate = devices.length > 0 ? Math.round((devices.filter((d) => d.status === "ONLINE").length / devices.length) * 100) : 0;
  const alertDevices = devices.filter((d) => d.status === "ALERT" || d.status === "OFFLINE");

  const categories = daily.map((r) => cnDate(r.date));
  const trendSeries = [
    { name: "预约总数", data: daily.map((r) => N(r.total_visitors)), area: true },
    { name: "入园核销", data: daily.map((r) => N(r.checked_in_count)) },
    { name: "爽约", data: daily.map((r) => N(r.noshow_count)) },
  ];

  const heatMatrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  heat.forEach((r) => {
    const weekIndex = r.dow;
    const hourIndex = r.hour;
    const validCell = weekIndex >= 0 && weekIndex < 7 && hourIndex >= 0 && hourIndex < 24;
    if (validCell) {
      heatMatrix[weekIndex][hourIndex] = N(r.bookings);
    }
  });

  const channelData = source.map((r) => ({ name: CHANNEL_CN[r.source_channel] ?? r.source_channel, value: N(r.visitor_count) }));
  const ageBars = profile
    .filter((r) => r.dimension.startsWith("年龄·"))
    .map((r) => ({ label: r.dimension.replace("年龄·", ""), value: N(r.value), hint: `${r.percentage}%` }));
  const now = end.getTime();
  const activeActivities = activities
    .filter((a) => a.status === "PUBLISHED" && +a.endDate >= now)
    .slice(0, 4)
    .map((a) => ({
      title: a.title,
      statusCn: +a.startDate > now ? "报名中" : "进行中",
      signups: a._count.signups,
      max: a.maxParticipants,
    }));
  const poiMarkers = pois
    .filter((p) => p.status === "PUBLISHED")
    .map((p) => ({ name: p.name, category: p.category, lat: Number(p.latitude), lng: Number(p.longitude) }));

  return (
    <ScreenShell size={ULTRAWIDE_SCREEN_SIZE}>
      <div className="flex h-full flex-col">
        <ScreenHeader
          title="长秋山森林公园 · 超宽融合指挥总屏"
          dataSource="snapshot"
          rightExtra={<PlaceholderTag text="天气/空气质量待接入" />}
        />

        {warn && (
          <div className="screen-flash mx-6 mt-3 rounded-lg px-6 py-3 text-center" style={{ border: "2px solid var(--screen-red)" }}>
            <p className="text-[22px] font-bold" style={{ color: "var(--screen-highlight)" }}>
              承载预警：在园人数已达瞬时承载量 {capacityPct}%，当日预约入口已自动暂停
            </p>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-4 p-6">
          <section className="grid grid-cols-8 gap-4" style={{ height: 300 }}>
            <KpiTile title="当前在园人数" value={checkedIn.toLocaleString("zh-CN")} unit="人" valueSize={48} tone={warn ? "danger" : "primary"} danger={warn} sub={`承载率 ${capacityPct}% / 上限 ${capacity.toLocaleString("zh-CN")}`} />
            <KpiTile title="今日累计预约" value={bookings.toLocaleString("zh-CN")} unit="人次" valueSize={48} sub={`履约率 ${fulfillRate}%`} />
            <KpiTile title="剩余预约名额" value={remaining.toLocaleString("zh-CN")} unit="个" valueSize={48} tone="highlight" sub={`共 ${slots.length} 个时段`} />
            <KpiTile title="设备在线率" value={`${deviceOnlineRate}%`} valueSize={48} sub={`设备 ${devices.length} 台 / 告警 ${alertDevices.length}`} />
            <KpiTile title="停车场负荷" value={`${parkingLoad}%`} valueSize={48} tone={parkingLoad >= 85 ? "warn" : "primary"} sub={`余位 ${Math.max(0, parkCapacity - parkOccupied).toLocaleString("zh-CN")}`} />
            <KpiTile title="今日活动" value={String(activeActivities.length)} unit="个" valueSize={48} sub="报名中 / 进行中" />
            <KpiTile title="已暂停时段" value={String(slots.filter((s) => s.status === "PAUSED").length)} unit="个" valueSize={48} tone={slots.some((s) => s.status === "PAUSED") ? "warn" : "primary"} sub="被动反映预约状态" />
            <KpiTile title="公开占位项" value="4" unit="项" valueSize={48} tone="highlight" sub={<PlaceholderTag text="外部数据待接入" />} />
          </section>

          <section className="grid min-h-0 flex-1 grid-cols-[24fr_52fr_24fr] gap-4">
            <div className="grid min-h-0 grid-rows-2 gap-4">
              <ScreenCard title="近 14 天客流趋势">
                <LineTrend height={270} categories={categories} series={trendSeries} />
              </ScreenCard>
              <ScreenCard title="预约渠道占比">
                {channelData.length > 0 ? (
                  <DonutChart height={270} showLegend data={channelData} />
                ) : (
                  <div className="flex h-full items-center justify-center text-[14px]" style={{ color: "var(--screen-text-faint)" }}>暂无渠道数据</div>
                )}
              </ScreenCard>
            </div>

            <ScreenCard title="融合指挥地图 · 点位 / 停车 / 设备告警">
              <div className="grid h-full grid-cols-[66fr_34fr] gap-4">
                <div className="relative overflow-hidden rounded-lg">
                  <AmapContainer
                    mapStyle="dark"
                    interactive={false}
                    fitView
                    markers={poiMarkers.map((p) => ({ lng: p.lng, lat: p.lat, title: p.name, tone: "success" as const, label: p.name }))}
                    fallback={
                      <div className="grid h-full grid-cols-2 gap-2 p-4" style={{ backgroundColor: "rgba(45,90,39,0.08)" }}>
                        {poiMarkers.slice(0, 12).map((p) => (
                          <div key={p.name} className="flex items-center gap-2 rounded px-3 py-2 text-[14px]" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                            <span style={{ color: "var(--screen-glow)" }}>●</span>
                            <span className="truncate" style={{ color: "var(--screen-text)" }}>{p.name}</span>
                            <span className="ml-auto text-[12px]" style={{ color: "var(--screen-text-faint)" }}>{p.category}</span>
                          </div>
                        ))}
                      </div>
                    }
                  />
                  {poiMarkers.length === 0 && (
                    <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded px-3 py-1.5" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                      <PlaceholderTag text="暂无点位数据" />
                    </div>
                  )}
                </div>
                <div className="grid grid-rows-3 gap-3">
                  <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(45,90,39,0.16)", border: "1px solid var(--screen-card-border)" }}>
                    <p className="text-[15px] font-semibold" style={{ color: "var(--screen-text)" }}>承载仪表</p>
                    <GaugeRing height={150} value={Math.min(100, capacityPct)} label="承载率" color={warn ? "var(--screen-red)" : "var(--screen-glow)"} />
                  </div>
                  <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(45,90,39,0.16)", border: "1px solid var(--screen-card-border)" }}>
                    <p className="text-[15px] font-semibold" style={{ color: "var(--screen-text)" }}>设备与停车</p>
                    <div className="grid h-full grid-cols-2 gap-2">
                      <GaugeRing height={132} value={deviceOnlineRate} label="设备在线率" color="var(--screen-glow)" />
                      <GaugeRing height={132} value={parkingLoad} label="停车负荷" color={parkingLoad >= 85 ? "var(--screen-orange)" : "var(--screen-blue)"} />
                    </div>
                  </div>
                  <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(45,90,39,0.16)", border: "1px solid var(--screen-card-border)" }}>
                    <p className="mb-2 text-[15px] font-semibold" style={{ color: "var(--screen-text)" }}>实时告警</p>
                    <div className="flex h-full flex-col gap-1.5 overflow-hidden">
                      {alertDevices.length === 0 ? (
                        <p className="text-[14px]" style={{ color: "var(--screen-text-faint)" }}>暂无告警</p>
                      ) : (
                        alertDevices.slice(0, 4).map((d) => (
                          <div key={d.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-[14px]" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                            <span style={{ color: d.status === "ALERT" ? "var(--screen-red)" : "var(--screen-orange)" }}>●</span>
                            <span className="truncate" style={{ color: "var(--screen-text)" }}>{d.name}</span>
                            <span className="ml-auto text-[12px]" style={{ color: "var(--screen-text-faint)" }}>{d.location ?? "未标注"}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ScreenCard>

            <div className="grid min-h-0 grid-rows-2 gap-4">
              <ScreenCard title="预约分时热力">
                <Heatmap724 matrix={heatMatrix} height={270} />
              </ScreenCard>
              <ScreenCard title="年龄段分布">
                <DarkBarList data={ageBars} emptyText="暂无画像数据" />
              </ScreenCard>
            </div>
          </section>

          <section className="grid grid-cols-[30fr_28fr_42fr] gap-4" style={{ height: 230 }}>
            <ScreenCard title="停车场余位">
              <StackedBar
                height={160}
                horizontal
                categories={lots.map((l) => l.name)}
                series={[
                  { name: "已占用", data: lots.map((l) => l.occupied) },
                  { name: "剩余", data: lots.map((l) => Math.max(0, l.capacity - l.occupied)) },
                ]}
              />
            </ScreenCard>
            <ScreenCard title="今日活动状态">
              <div className="flex h-full flex-col gap-2 overflow-hidden">
                {activeActivities.length === 0 ? (
                  <p className="text-[14px]" style={{ color: "var(--screen-text-faint)" }}>今日暂无活动</p>
                ) : (
                  activeActivities.map((a) => (
                    <div key={a.title} className="rounded px-3 py-2 text-[14px]" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate" style={{ color: "var(--screen-text)" }}>{a.title}</span>
                        <span style={{ color: "var(--screen-glow)" }}>{a.statusCn}</span>
                      </div>
                      <p className="mt-0.5 text-[12px]" style={{ color: "var(--screen-text-dim)" }}>报名 {a.signups}{a.max ? ` / ${a.max}` : ""}</p>
                    </div>
                  ))
                )}
              </div>
            </ScreenCard>
            <ScreenCard title="执行边界">
              <div className="grid h-full grid-cols-4 gap-3 text-[14px]">
                {[
                  ["无登录访问", "访问令牌软门 + 反代地址白名单"],
                  ["数据口径", "只读聚合，禁止返回原始预约/黑名单/申诉行"],
                  ["熔断机制", "大屏只反映状态，不触发写入"],
                  ["待接入", "天气/AQI、地域画像、浏览量、三维漫游"],
                ].map(([title, body]) => (
                  <div key={title} className="rounded px-3 py-3" style={{ backgroundColor: "var(--screen-card-bg)", border: "1px solid var(--screen-card-border)" }}>
                    <p className="font-semibold" style={{ color: "var(--screen-highlight)" }}>{title}</p>
                    <p className="mt-2 leading-relaxed" style={{ color: "var(--screen-text-dim)" }}>{body}</p>
                  </div>
                ))}
              </div>
            </ScreenCard>
          </section>
        </div>
      </div>
    </ScreenShell>
  );
}

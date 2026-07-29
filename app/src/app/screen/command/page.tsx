import { bookingService } from "@/modules/booking";
import { analyticsRepository } from "@/modules/analytics";
import { contentRepository } from "@/modules/content";
import { iotRepository } from "@/modules/iot";
import { trafficRepository } from "@/modules/traffic";
import { configService } from "@/modules/system";
import { fetchWeather } from "@/infrastructure/amap";
import { CIRCUIT_BREAK_RATIO, resolveInstantCapacity } from "@/shared/lib/capacity";
import { buildDispatch, PARKING_FULL_RATIO } from "@/shared/lib/dispatch";
import { chinaToday } from "@/shared/lib/time";
import { ScreenShell } from "@/lib/ui/screen/ScreenShell";
import { ScreenHeader } from "@/lib/ui/screen/ScreenHeader";
import { ScreenCard } from "@/lib/ui/screen/ScreenCard";
import { KpiTile } from "@/lib/ui/screen/KpiTile";
import { DarkBarList } from "@/lib/ui/screen/DarkBarList";
import { PlaceholderTag } from "@/lib/ui/screen/PlaceholderTag";
import { ScreenWeather } from "@/lib/ui/screen/ScreenWeather";
import { DonutChart } from "@/lib/ui/screen/charts/DonutChart";
import { GaugeRing } from "@/lib/ui/screen/charts/GaugeRing";
import { Heatmap724 } from "@/lib/ui/screen/charts/Heatmap724";
import { LineTrend } from "@/lib/ui/screen/charts/LineTrend";
import { StackedBar } from "@/lib/ui/screen/charts/StackedBar";
import { RadarChart } from "@/lib/ui/screen/charts/RadarChart";
import { FunnelChart } from "@/lib/ui/screen/charts/FunnelChart";
import { ULTRAWIDE_SCREEN_SIZE } from "@/lib/ui/screen/use-screen-scale";
import { AmapContainer } from "@/lib/ui/map/AmapContainer";
import { ScreenAutoRefresh } from "./ScreenAutoRefresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "超宽融合指挥总屏 · 长秋山森林公园智慧景区" };

const N = (v: bigint | number | null | undefined) => (v == null ? 0 : Number(v));
const pctOf = (rows: { dimension: string; percentage: number }[], dim: string) =>
  Math.round(rows.find((r) => r.dimension === dim)?.percentage ?? 0);

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
  start.setDate(start.getDate() - 29); // 近 30 日

  const [slots, capacity, daily, heat, devices, lots, pois, profile, channelSrc, activities, travel, regionProv, regionCity, hourly, weather] =
    await Promise.all([
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
      analyticsRepository.getTravelPreference().catch(() => []),
      analyticsRepository.getVisitorRegionByProvince().catch(() => []),
      analyticsRepository.getVisitorRegionByCity().catch(() => []),
      analyticsRepository.getHourlyPeak().catch(() => []),
      fetchWeather().catch(() => ({ source: "error" as const, live: null })),
    ]);

  // —— 概览聚合 ——
  const bookings = slots.reduce((s, sl) => s + sl.bookedCount, 0);
  const checkedIn = slots.reduce((s, sl) => s + sl.checkedInCount, 0);
  const remaining = slots.reduce((s, sl) => s + Math.max(0, sl.capacity - sl.bookedCount), 0);
  const capacityPct = capacity > 0 ? Math.round((checkedIn / capacity) * 100) : 0;
  const warn = capacityPct >= CIRCUIT_BREAK_RATIO * 100;
  const soldOutSlots = slots.filter((s) => s.capacity > 0 && s.bookedCount >= s.capacity);

  const parkCapacity = lots.reduce((s, l) => s + l.capacity, 0);
  const parkOccupied = lots.reduce((s, l) => s + l.occupied, 0);
  const parkRemaining = Math.max(0, parkCapacity - parkOccupied);
  const fullLots = lots.filter((l) => l.capacity > 0 && l.occupied / l.capacity >= PARKING_FULL_RATIO);
  const deviceOnlineRate = devices.length > 0 ? Math.round((devices.filter((d) => d.status === "ONLINE").length / devices.length) * 100) : 0;
  const alertDevices = devices.filter((d) => d.status === "ALERT" || d.status === "OFFLINE");

  const now = end.getTime();
  const activeActivities = activities.filter((a) => a.status === "PUBLISHED" && +a.endDate >= now);

  // —— 趋势(近30日) ——
  const categories = daily.map((r) => cnDate(r.date));
  const trendSeries = [
    { name: "预约总数", data: daily.map((r) => N(r.total_visitors)), area: true },
    { name: "入园核销", data: daily.map((r) => N(r.checked_in_count)) },
    { name: "爽约", data: daily.map((r) => N(r.noshow_count)) },
  ];

  // —— 客源地占比(本市/省内其他/省外),base=去重游客省级合计 ——
  const baseRegion = regionProv.reduce((s, r) => s + N(r.visitor_count), 0);
  const sichuanCount = regionProv.filter((r) => r.code.startsWith("51")).reduce((s, r) => s + N(r.visitor_count), 0);
  const chengduCount = N(regionCity.find((r) => r.code === "5101" || r.name.includes("成都"))?.visitor_count);
  const provinceOther = Math.max(0, sichuanCount - chengduCount);
  const outProvince = Math.max(0, baseRegion - sichuanCount);
  const sourcePctBars =
    baseRegion > 0
      ? [
          { label: "本市(成都)", value: chengduCount, hint: `${Math.round((chengduCount / baseRegion) * 100)}%` },
          { label: "省内其他", value: provinceOther, hint: `${Math.round((provinceOther / baseRegion) * 100)}%` },
          { label: "省外", value: outProvince, hint: `${Math.round((outProvince / baseRegion) * 100)}%` },
        ]
      : [];
  const localPct = baseRegion > 0 ? Math.round((chengduCount / baseRegion) * 100) : 0;

  // —— 分时入园(日均) ——
  const hourCats = hourly.map((r) => `${r.hour}时`);
  const hourSeries = [{ name: "日均入园人次", data: hourly.map((r) => N(r.avg_visitors)) }];

  // —— 7×24 热力 ——
  const heatMatrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  heat.forEach((r) => {
    if (r.dow >= 0 && r.dow < 7 && r.hour >= 0 && r.hour < 24) heatMatrix[r.dow][r.hour] = N(r.bookings);
  });

  // —— POI(地图标记 + 高负荷近似:园区级承载估算,未细分到点位) ——
  const publishedPois = pois.filter((p) => p.status === "PUBLISHED");
  const topPois = publishedPois.slice(0, 5);
  const poiMarkers = publishedPois.map((p) => ({ lng: Number(p.longitude), lat: Number(p.latitude), title: p.name }));

  // —— 画像雷达(5 轴) ——
  const radarIndicators = [
    { name: "男性占比", max: 100 },
    { name: "青年(18-30)", max: 100 },
    { name: "本市(成都)", max: 100 },
    { name: "自驾出行", max: 100 },
    { name: "午前入园", max: 100 },
  ];
  const radarSeries = [
    {
      name: "今日画像",
      values: [
        pctOf(profile, "性别·男"),
        pctOf(profile, "年龄·18-30岁"),
        localPct,
        pctOf(travel, "出行·自驾"),
        pctOf(travel, "时段·上午(12时前)"),
      ],
    },
  ];

  // —— TOP8 客源城市 ——
  const topCities = [...regionCity]
    .sort((a, b) => N(b.visitor_count) - N(a.visitor_count))
    .slice(0, 8)
    .map((r) => ({ label: r.name, value: N(r.visitor_count) }));

  // —— 出行 / 入园时段偏好 ——
  const travelBars = [
    { label: "自驾", value: pctOf(travel, "出行·自驾"), hint: `${pctOf(travel, "出行·自驾")}%` },
    { label: "非自驾", value: pctOf(travel, "出行·非自驾"), hint: `${pctOf(travel, "出行·非自驾")}%` },
  ];
  const timeBars = [
    { label: "上午", value: pctOf(travel, "时段·上午(12时前)"), hint: `${pctOf(travel, "时段·上午(12时前)")}%` },
    { label: "下午", value: pctOf(travel, "时段·下午(12-16时)"), hint: `${pctOf(travel, "时段·下午(12-16时)")}%` },
    { label: "傍晚", value: pctOf(travel, "时段·傍晚(16时后)"), hint: `${pctOf(travel, "时段·傍晚(16时后)")}%` },
  ];

  // —— 渠道占比(visitor_source MV 实为 booking.channel) ——
  const channelData = channelSrc.map((r) => ({ name: CHANNEL_CN[r.source_channel] ?? r.source_channel, value: N(r.visitor_count) }));

  // —— 实时异常预警(设备 + 业务派生,真实可产生类型) ——
  type AlertItem = { tone: "red" | "orange" | "dim"; title: string; desc: string };
  const alerts: AlertItem[] = [];
  alertDevices.forEach((d) =>
    alerts.push({ tone: d.status === "ALERT" ? "red" : "orange", title: `${d.name} ${d.status === "ALERT" ? "告警" : "离线"}`, desc: d.location ?? "未标注位置" }),
  );
  fullLots.forEach((l) => alerts.push({ tone: "red", title: `${l.name} 接近满载`, desc: `占用率 ${Math.round((l.occupied / l.capacity) * 100)}%` }));
  if (capacityPct >= 80) {
    alerts.push({ tone: warn ? "red" : "orange", title: "在园承载率偏高", desc: `当前 ${capacityPct}%,距 90% 熔断线 ${Math.max(0, 90 - capacityPct)} 个百分点` });
  }
  if (soldOutSlots.length > 0) {
    alerts.push({ tone: "orange", title: "时段名额售罄", desc: `${soldOutSlots.length} 个时段已约满,建议引导改约` });
  }
  const toneColor: Record<AlertItem["tone"], string> = {
    red: "var(--screen-red)",
    orange: "var(--screen-orange)",
    dim: "var(--screen-text-faint)",
  };

  // —— 智能调度策略(规则模板,两态) ——
  const dispatch = buildDispatch({
    occupancyPct: capacityPct,
    fullLotNames: fullLots.map((l) => l.name),
    soldOutSlotCount: soldOutSlots.length,
    alertDeviceNames: alertDevices.map((d) => d.name),
  });

  return (
    <ScreenShell size={ULTRAWIDE_SCREEN_SIZE}>
      <ScreenAutoRefresh />
      <div className="flex h-full flex-col">
        <ScreenHeader title="长秋山森林公园 · 超宽融合指挥总屏" dataSource="polling" rightExtra={<ScreenWeather initial={weather} />} />

        {warn && (
          <div className="screen-flash mx-6 mt-3 rounded-lg px-6 py-3 text-center" style={{ border: "2px solid var(--screen-red)" }}>
            <p className="text-[22px] font-bold" style={{ color: "var(--screen-highlight)" }}>
              承载预警:在园人数已达瞬时承载量 {capacityPct}%,当日预约入口已自动暂停
            </p>
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-[640fr_760fr_1180fr_650fr_520fr] gap-4 p-6">
          {/* ① 概览 */}
          <div className="flex min-h-0 flex-col gap-4">
            <ScreenCard title="当前在园总人数">
              <div className="flex items-end justify-between">
                <span className="font-bold tabular-nums leading-none" style={{ fontSize: 56, color: warn ? "var(--screen-red)" : "var(--screen-glow)", textShadow: "var(--screen-glow-shadow)" }}>
                  {checkedIn.toLocaleString("zh-CN")}
                </span>
                <div className="text-right">
                  <p className="text-[18px]" style={{ color: "var(--screen-text)" }}>容量占比 {capacityPct}%</p>
                  <p className="text-[13px]" style={{ color: "var(--screen-text-dim)" }}>承载上限 {capacity.toLocaleString("zh-CN")}</p>
                </div>
              </div>
              <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--screen-card-bg-strong)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, capacityPct)}%`, backgroundColor: warn ? "var(--screen-red)" : "var(--screen-glow)" }} />
                <div className="absolute top-0 h-full" style={{ left: "90%", width: 2, backgroundColor: "var(--screen-orange)" }} title="90% 熔断线" />
              </div>
              <p className="mt-1 text-right text-[12px]" style={{ color: "var(--screen-orange)" }}>↑ 90% 熔断线</p>
            </ScreenCard>

            <ScreenCard title="景区实时动态感知" className="flex-1">
              <div className="grid h-full grid-cols-2 gap-3">
                <KpiTile title="今日总预约" value={bookings.toLocaleString("zh-CN")} unit="人次" valueSize={32} />
                <KpiTile title="今日已核销" value={checkedIn.toLocaleString("zh-CN")} unit="人" valueSize={32} tone="highlight" />
                <KpiTile title="剩余可预约" value={remaining.toLocaleString("zh-CN")} unit="个" valueSize={32} />
                <KpiTile title="停车场余位" value={parkRemaining.toLocaleString("zh-CN")} unit="辆" valueSize={32} tone={parkRemaining < parkCapacity * 0.1 ? "warn" : "primary"} />
                <KpiTile title="进行中活动" value={String(activeActivities.length)} unit="项" valueSize={32} />
                <KpiTile title="未处理预警" value={String(alertDevices.length)} unit="条" valueSize={32} tone={alertDevices.length > 0 ? "danger" : "primary"} />
              </div>
            </ScreenCard>

            <ScreenCard title="预约核销转化漏斗">
              <FunnelChart height={210} data={[{ name: "今日预约", value: bookings }, { name: "入园核销", value: checkedIn }]} />
            </ScreenCard>
          </div>

          {/* ② 趋势 */}
          <div className="flex min-h-0 flex-col gap-4">
            <ScreenCard title="近 30 日客流趋势 (预约 / 核销 / 爽约)">
              <LineTrend height={250} categories={categories} series={trendSeries} />
            </ScreenCard>
            <div className="grid grid-cols-2 gap-4">
              <ScreenCard title="客源地占比">
                <DarkBarList data={sourcePctBars} emptyText="暂无地域画像" />
              </ScreenCard>
              <ScreenCard title="今日分时入园分布">
                {hourCats.length > 0 ? (
                  <StackedBar height={200} categories={hourCats} series={hourSeries} />
                ) : (
                  <div className="flex h-full items-center justify-center text-[14px]" style={{ color: "var(--screen-text-faint)" }}>暂无分时数据</div>
                )}
              </ScreenCard>
            </div>
            <ScreenCard title="7×24h 预约热力矩阵与高负荷点位" className="flex-1">
              <div className="grid h-full grid-cols-[60fr_40fr] gap-4">
                <Heatmap724 matrix={heatMatrix} height={230} />
                <div className="flex flex-col">
                  <div className="mb-2 flex items-center gap-2 text-[14px]" style={{ color: "var(--screen-text)" }}>
                    <span style={{ color: "var(--screen-orange)" }}>⚠</span> 高负荷点位
                    <PlaceholderTag text="园区级估算" />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 overflow-hidden">
                    {topPois.length === 0 ? (
                      <p className="text-[13px]" style={{ color: "var(--screen-text-faint)" }}>暂无点位数据</p>
                    ) : (
                      topPois.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded px-2 py-1.5 text-[13px]" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                          <span className="truncate" style={{ color: "var(--screen-text)" }}>{p.name}</span>
                          <span className="shrink-0" style={{ color: capacityPct >= 80 ? "var(--screen-orange)" : "var(--screen-text-dim)" }}>约 {capacityPct}%</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </ScreenCard>
          </div>

          {/* ③ 中央态势图 */}
          <ScreenCard title="景区实时态势分布图">
            <div className="flex h-full flex-col gap-3">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg">
                <AmapContainer
                  mapStyle="dark"
                  interactive={false}
                  fitView
                  markers={poiMarkers.map((p) => ({ lng: p.lng, lat: p.lat, title: p.title, tone: "success" as const, label: p.title }))}
                  fallback={
                    <div className="grid h-full grid-cols-3 gap-2 p-4" style={{ backgroundColor: "rgba(45,90,39,0.08)" }}>
                      {poiMarkers.slice(0, 18).map((p) => (
                        <div key={p.title} className="flex items-center gap-2 rounded px-3 py-2 text-[14px]" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                          <span style={{ color: "var(--screen-glow)" }}>●</span>
                          <span className="truncate" style={{ color: "var(--screen-text)" }}>{p.title}</span>
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
              <div className="rounded-lg px-5 py-3" style={{ backgroundColor: "rgba(45,90,39,0.16)", border: "1px solid var(--screen-card-border)" }}>
                <div className="flex items-center justify-between text-[15px]">
                  <span style={{ color: "var(--screen-text)" }}>全局承载安全态势</span>
                  <span className="font-bold" style={{ color: warn ? "var(--screen-red)" : "var(--screen-glow)" }}>
                    {warn ? "已达熔断线" : `距 90% 熔断线 ${Math.max(0, 90 - capacityPct)} 个百分点`}
                  </span>
                </div>
                <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--screen-card-bg-strong)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, capacityPct)}%`, backgroundColor: warn ? "var(--screen-red)" : "var(--screen-glow)" }} />
                  <div className="absolute top-0 h-full" style={{ left: "90%", width: 2, backgroundColor: "var(--screen-red)" }} />
                </div>
              </div>
            </div>
          </ScreenCard>

          {/* ④ 画像 */}
          <div className="flex min-h-0 flex-col gap-4">
            <ScreenCard title="今日游客基础画像">
              <RadarChart height={250} indicators={radarIndicators} series={radarSeries} />
            </ScreenCard>
            <ScreenCard title="核心客源城市前 8 位" className="flex-1">
              <DarkBarList data={topCities} emptyText="暂无客源城市数据" />
            </ScreenCard>
            <ScreenCard title="出行与入园偏好分析">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2 text-center text-[13px]" style={{ color: "var(--screen-text-dim)" }}>出行方式</p>
                  <DarkBarList data={travelBars} emptyText="暂无数据" />
                </div>
                <div className="border-l pl-4" style={{ borderColor: "var(--screen-card-border)" }}>
                  <p className="mb-2 text-center text-[13px]" style={{ color: "var(--screen-text-dim)" }}>入园时段偏好</p>
                  <DarkBarList data={timeBars} emptyText="暂无数据" color="var(--screen-blue)" />
                </div>
              </div>
            </ScreenCard>
          </div>

          {/* ⑤ 告警 / 调度 */}
          <div className="flex min-h-0 flex-col gap-4">
            <ScreenCard title="实时异常预警与通知">
              <div className="flex flex-col gap-2 overflow-hidden">
                {alerts.length === 0 ? (
                  <p className="text-[14px]" style={{ color: "var(--screen-text-faint)" }}>当前无异常</p>
                ) : (
                  alerts.slice(0, 6).map((a, i) => (
                    <div key={i} className="rounded px-3 py-2" style={{ backgroundColor: "var(--screen-card-bg)", borderLeft: `3px solid ${toneColor[a.tone]}` }}>
                      <p className="text-[14px] font-semibold" style={{ color: "var(--screen-text)" }}>{a.title}</p>
                      <p className="text-[12px]" style={{ color: "var(--screen-text-dim)" }}>{a.desc}</p>
                    </div>
                  ))
                )}
              </div>
            </ScreenCard>

            <ScreenCard title="设备健康度 / 预约渠道">
              <div className="grid h-full grid-cols-2 gap-3">
                <div className="flex flex-col items-center justify-center">
                  <GaugeRing height={150} value={deviceOnlineRate} label="设备在线率" color="var(--screen-glow)" />
                  <p className="text-[12px]" style={{ color: "var(--screen-text-dim)" }}>
                    在线 {devices.filter((d) => d.status === "ONLINE").length} / 离线 {devices.filter((d) => d.status === "OFFLINE").length}
                  </p>
                </div>
                <div className="border-l pl-3" style={{ borderColor: "var(--screen-card-border)" }}>
                  {channelData.length > 0 ? (
                    <DonutChart height={170} showLegend data={channelData} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[13px]" style={{ color: "var(--screen-text-faint)" }}>暂无渠道数据</div>
                  )}
                </div>
              </div>
            </ScreenCard>

            <ScreenCard title="智能调度策略建议 (AI生成)" className="flex-1">
              {!dispatch.active ? (
                <div className="flex h-full flex-col items-center justify-center gap-2">
                  <span className="text-[15px]" style={{ color: "var(--screen-glow)" }}>🟢 当前运行平稳</span>
                  <span className="text-[13px]" style={{ color: "var(--screen-text-faint)" }}>暂无调度建议</span>
                </div>
              ) : (
                <div className="flex h-full flex-col gap-2">
                  <div className="flex items-center justify-between rounded px-3 py-1.5" style={{ backgroundColor: "rgba(220,38,38,0.16)", border: "1px solid var(--screen-red)" }}>
                    <span className="text-[13px] font-semibold" style={{ color: "var(--screen-highlight)" }}>🔴 特殊态势 · 已生成调度策略</span>
                    <span className="rounded px-2 py-0.5 text-[12px]" style={{ backgroundColor: "var(--screen-card-bg-strong)", color: "var(--screen-orange)" }}>待执行</span>
                  </div>
                  <p className="text-[13px]" style={{ color: "var(--screen-text-dim)" }}>{dispatch.situation}</p>
                  <ol className="flex flex-col gap-1.5">
                    {dispatch.strategies.map((s, i) => (
                      <li key={i} className="flex gap-2 rounded px-3 py-2 text-[13px]" style={{ backgroundColor: "var(--screen-card-bg)", color: "var(--screen-text)" }}>
                        <span className="font-bold" style={{ color: "var(--screen-glow)" }}>{i + 1}.</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-auto text-[12px]" style={{ color: "var(--screen-text-faint)" }}>请相关岗位按策略执行</p>
                </div>
              )}
            </ScreenCard>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

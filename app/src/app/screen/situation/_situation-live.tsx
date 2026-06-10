"use client";

import { ScreenHeader } from "@/lib/ui/screen/ScreenHeader";
import { ScreenCard } from "@/lib/ui/screen/ScreenCard";
import { KpiTile } from "@/lib/ui/screen/KpiTile";
import { DarkBarList } from "@/lib/ui/screen/DarkBarList";
import { PlaceholderTag } from "@/lib/ui/screen/PlaceholderTag";
import { LiveDot } from "@/lib/ui/live-dot";
import { AmapContainer } from "@/lib/ui/map/AmapContainer";
import { DonutChart } from "@/lib/ui/screen/charts/DonutChart";
import { StackedBar } from "@/lib/ui/screen/charts/StackedBar";
import { useScreenPoll } from "@/lib/ui/screen/use-screen-poll";

export interface OccupancyMetric {
  occupancy: number;
  capacity: number;
  bookings: number;
  pct: number;
  circuitBroken: boolean;
  paused: boolean;
}
export interface AlertItem {
  name: string;
  location: string | null;
  status: string;
}
export interface SituationData {
  occupancy: OccupancyMetric;
  checkedIn: number;
  device: { total: number; online: number; alert: number; offline: number };
  alerts: AlertItem[];
  gender: { men: number; women: number };
  ageBars: { label: string; value: number; hint?: string }[];
  channels: { name: string; value: number }[];
  activities: { title: string; statusCn: string; signups: number; max: number | null }[];
  pois: { name: string; category: string; lat: number; lng: number }[];
}

const ALERT_TONE: Record<string, string> = { ALERT: "var(--screen-red)", OFFLINE: "var(--screen-orange)" };
const ALERT_CN: Record<string, string> = { ALERT: "告警", OFFLINE: "离线" };

export function SituationLive({ data }: { data: SituationData }) {
  const { data: occ, state, updatedAt } = useScreenPoll<OccupancyMetric>("occupancy", data.occupancy, 15_000);
  const { data: alerts } = useScreenPoll<AlertItem[]>("alerts", data.alerts, 20_000);

  const pct = occ.pct;
  const warn = pct >= 90;
  const onlineRate = data.device.total > 0 ? Math.round((data.device.online / data.device.total) * 100) : 0;
  // occ.occupancy 即在园=今日累计入园核销(checkedInCount 之和),随轮询刷新;
  // 故入园/履约一律用 occ.occupancy,避免与冻结的 SSR 初值在长时间挂墙时漂移(审计 P2)。
  const liveCheckedIn = occ.occupancy;
  const fulfillRate = occ.bookings > 0 ? Math.round((liveCheckedIn / occ.bookings) * 1000) / 10 : 0;

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="长秋山森林公园智慧景区 · 数字孪生指挥中心" dataSource={state} />

      {/* 承载熔断横幅:色 + 文字双编码 */}
      {warn && (
        <div className="screen-flash mx-6 mt-3 rounded-lg px-6 py-3 text-center" style={{ border: "2px solid var(--screen-red)" }}>
          <p className="text-[22px] font-bold" style={{ color: "var(--screen-highlight)" }}>
            ⚠ 承载预警：在园人数已达瞬时承载量 90%（{pct}%），当日预约入口已自动暂停
          </p>
        </div>
      )}

      <div className="grid flex-1 grid-cols-[24fr_52fr_24fr] gap-4 p-6">
        {/* 左纵栏 */}
        <div className="flex flex-col gap-3">
          <ScreenCard title="当前在园总人数">
            <p className="text-center text-[56px] font-bold leading-none tabular-nums" style={{ color: warn ? "var(--screen-red)" : "var(--screen-glow)", textShadow: "var(--screen-glow-shadow)" }}>
              {occ.occupancy.toLocaleString("zh-CN")}
            </p>
            <p className="mt-2 text-center text-[13px]" style={{ color: "var(--screen-text-dim)" }}>
              承载率 {pct}% / 红线 {occ.capacity.toLocaleString("zh-CN")} 人
            </p>
            <div className="mt-2 h-2.5 overflow-hidden rounded" style={{ backgroundColor: "rgba(232,245,233,0.12)" }}>
              <div className="h-full rounded" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: warn ? "var(--screen-red)" : "var(--screen-glow)", boxShadow: "0 0 8px rgba(74,142,63,0.6)" }} />
            </div>
            {updatedAt && <p className="mt-1 text-right text-[11px]" style={{ color: "var(--screen-text-faint)" }}>更新于 {updatedAt}</p>}
          </ScreenCard>

          <KpiTile title="今日累计入园核销" value={liveCheckedIn.toLocaleString("zh-CN")} unit="人次" valueSize={40} tone="highlight" sub={`履约率 ${fulfillRate}%`} />

          <ScreenCard title="今日预约 / 实际入园">
            <div className="flex items-center justify-around">
              <div className="text-center">
                <p className="text-[26px] font-bold tabular-nums" style={{ color: "var(--screen-text)" }}>{occ.bookings.toLocaleString("zh-CN")}</p>
                <p className="text-[12px]" style={{ color: "var(--screen-text-dim)" }}>预约</p>
              </div>
              <div className="text-center">
                <p className="text-[26px] font-bold tabular-nums" style={{ color: "var(--screen-blue)" }}>{liveCheckedIn.toLocaleString("zh-CN")}</p>
                <p className="text-[12px]" style={{ color: "var(--screen-text-dim)" }}>实际</p>
              </div>
              <div className="text-center">
                <p className="text-[26px] font-bold tabular-nums" style={{ color: "var(--screen-glow)" }}>{fulfillRate}%</p>
                <p className="text-[12px]" style={{ color: "var(--screen-text-dim)" }}>履约率</p>
              </div>
            </div>
          </ScreenCard>

          <ScreenCard title="在园游客性别比例">
            <DonutChart height={140} showLegend data={[{ name: "男", value: data.gender.men }, { name: "女", value: data.gender.women }]} />
          </ScreenCard>

          <ScreenCard title="年龄段分布" className="flex-1">
            <div className="h-full">
              <DarkBarList data={data.ageBars} emptyText="暂无画像数据" />
            </div>
          </ScreenCard>
        </div>

        {/* 中央地图主区 */}
        <div className="flex flex-col gap-3">
          <ScreenCard title="数字孪生地形与 POI 实时分布" className="flex-1">
            <div className="relative h-full overflow-hidden rounded-lg">
              <AmapContainer
                mapStyle="dark"
                interactive={false}
                fitView
                markers={data.pois.map((p) => ({ lng: p.lng, lat: p.lat, title: p.name, tone: "success" as const, label: p.name }))}
                fallback={
                  /* 降级:地图不可用时回 POI 坐标列表(真实数据) */
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-4" style={{ backgroundColor: "rgba(45,90,39,0.08)" }}>
                    <p className="text-[16px]" style={{ color: "var(--screen-text-dim)" }}>三维数字孪生地图</p>
                    <div className="grid w-full grid-cols-2 gap-1.5">
                      {data.pois.slice(0, 8).map((p) => (
                        <div key={p.name} className="flex items-center gap-2 rounded px-2 py-1 text-[13px]" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                          <span style={{ color: "var(--screen-glow)" }}>●</span>
                          <span className="truncate" style={{ color: "var(--screen-text)" }}>{p.name}</span>
                          <span className="ml-auto tabular-nums text-[12px]" style={{ color: "var(--screen-text-faint)" }}>
                            {p.lat.toFixed(3)},{p.lng.toFixed(3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                }
              />
              {data.pois.length === 0 && (
                <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded px-3 py-1.5" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                  <PlaceholderTag text="暂无 POI 数据" />
                </div>
              )}
            </div>
          </ScreenCard>

          {/* 警报状态条 */}
          <div
            className="flex items-center justify-between rounded-lg px-5 py-3"
            style={{ border: `1px solid ${warn ? "var(--screen-red)" : "var(--screen-card-border)"}`, backgroundColor: "var(--screen-card-bg)" }}
          >
            <span className="flex items-center gap-2 text-[18px] font-bold" style={{ color: warn ? "var(--screen-red)" : "var(--screen-glow)" }}>
              {warn ? "⚠" : "✓"} 承载率 {pct}% · {warn ? "已熔断停约" : "安全"}
            </span>
            <span className="flex items-center gap-4 text-[14px]" style={{ color: "var(--screen-text-dim)" }}>
              <span className="flex items-center gap-1.5"><LiveDot tone="connected" label="预约" />预约</span>
              <span className="flex items-center gap-1.5"><LiveDot tone="connected" label="闸机" />闸机</span>
              <span className="flex items-center gap-1.5"><LiveDot tone={data.device.online > 0 ? "connected" : "disconnected"} label="设备" />设备 {onlineRate}%</span>
            </span>
          </div>
        </div>

        {/* 右纵栏 */}
        <div className="flex flex-col gap-3">
          <ScreenCard title="实时告警事件" className="flex-1">
            <div className="flex flex-col gap-1.5">
              {alerts.length === 0 ? (
                <p className="text-[14px]" style={{ color: "var(--screen-text-faint)" }}>暂无告警</p>
              ) : (
                alerts.slice(0, 6).map((a, i) => (
                  <div key={`${a.name}-${i}`} className="flex items-center gap-2 rounded px-2 py-1.5 text-[14px]" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                    <span style={{ color: ALERT_TONE[a.status] ?? "var(--screen-text-dim)" }}>●</span>
                    <span className="truncate" style={{ color: "var(--screen-text)" }}>{a.name}</span>
                    {a.location && <span className="truncate text-[12px]" style={{ color: "var(--screen-text-faint)" }}>{a.location}</span>}
                    <span className="ml-auto text-[12px]" style={{ color: ALERT_TONE[a.status] ?? "var(--screen-text-dim)" }}>{ALERT_CN[a.status] ?? a.status}</span>
                  </div>
                ))
              )}
            </div>
          </ScreenCard>

          <ScreenCard title="今日预约渠道分布">
            {data.channels.length > 0 ? (
              <StackedBar height={120} horizontal percent categories={["渠道"]} series={data.channels.map((c) => ({ name: c.name, data: [c.value] }))} />
            ) : (
              <p className="text-[14px]" style={{ color: "var(--screen-text-faint)" }}>暂无渠道数据</p>
            )}
          </ScreenCard>

          <ScreenCard title="客源地 前 5 名">
            <div className="flex h-full flex-col items-center justify-center gap-2 text-[14px]" style={{ color: "var(--screen-text-faint)" }}>
              需行政区划码表派生
              <PlaceholderTag text="客源地画像待接入" />
            </div>
          </ScreenCard>

          <ScreenCard title="今日活动状态" className="flex-1">
            <div className="flex flex-col gap-1.5">
              {data.activities.length === 0 ? (
                <p className="text-[14px]" style={{ color: "var(--screen-text-faint)" }}>今日暂无活动</p>
              ) : (
                data.activities.slice(0, 4).map((a) => (
                  <div key={a.title} className="rounded px-2 py-1.5 text-[14px]" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                    <div className="flex items-center justify-between">
                      <span className="truncate" style={{ color: "var(--screen-text)" }}>{a.title}</span>
                      <span className="text-[12px]" style={{ color: "var(--screen-glow)" }}>{a.statusCn}</span>
                    </div>
                    <p className="text-[12px]" style={{ color: "var(--screen-text-dim)" }}>
                      报名 {a.signups}{a.max ? ` / ${a.max}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScreenCard>
        </div>
      </div>
    </div>
  );
}

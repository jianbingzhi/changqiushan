"use client";

import { ScreenHeader } from "@/lib/ui/screen/ScreenHeader";
import { ScreenCard } from "@/lib/ui/screen/ScreenCard";
import { PlaceholderTag } from "@/lib/ui/screen/PlaceholderTag";
import { GaugeRing } from "@/lib/ui/screen/charts/GaugeRing";
import { AmapContainer } from "@/lib/ui/map/AmapContainer";
import { useScreenPoll } from "@/lib/ui/screen/use-screen-poll";
import type { OccupancyMetric, AlertItem } from "../situation/_situation-live";

export interface TwinData {
  occupancy: OccupancyMetric;
  checkedIn: number;
  device: { total: number; online: number; alert: number; offline: number };
  deviceOnlineRate: number;
  parkingLoad: number;
  openAreas: { open: number; total: number };
  alerts: AlertItem[];
  pois: { name: string; category: string; lat: number; lng: number }[];
  categories: string[];
  center: { lat: number; lng: number } | null;
}

const ALERT_TONE: Record<string, string> = { ALERT: "var(--screen-red)", OFFLINE: "var(--screen-orange)" };
const ALERT_CN: Record<string, string> = { ALERT: "紧急", OFFLINE: "重要" };
const CATEGORY_COLORS = ["#4A8E3F", "#4FB3E0", "#D97706", "#9AD6B0", "#2D5A27", "#E8F5E9"];

export function TwinLive({ data }: { data: TwinData }) {
  const { data: occ, state } = useScreenPoll<OccupancyMetric>("occupancy", data.occupancy, 15_000);
  const { data: alerts } = useScreenPoll<AlertItem[]>("alerts", data.alerts, 20_000);

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="长秋山森林公园 导览图 · 数字孪生底座" dataSource={state} />

      <div className="grid flex-1 grid-cols-[70fr_30fr] gap-4 p-6">
        {/* 左:KPI + 地图 */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "当前在园人数", value: occ.occupancy.toLocaleString("zh-CN"), color: "var(--screen-glow)" },
              { label: "开放区域 / 设施", value: `${data.openAreas.open} / ${data.openAreas.total}`, color: "var(--screen-glow)" },
              { label: "告警 / 事件总数", value: String(alerts.length), color: alerts.length > 0 ? "var(--screen-orange)" : "var(--screen-glow)" },
            ].map((k) => (
              <div key={k.label} className="rounded-lg px-4 py-3" style={{ backgroundColor: "var(--screen-card-bg)", border: "1px solid var(--screen-card-border)" }}>
                <p className="text-[13px]" style={{ color: "var(--screen-text-dim)" }}>{k.label}</p>
                <p className="mt-1 text-[28px] font-bold tabular-nums" style={{ color: k.color, textShadow: "var(--screen-glow-shadow)" }}>{k.value}</p>
              </div>
            ))}
          </div>

          <ScreenCard title="长秋山森林公园 导览图" className="flex-1">
            <div className="relative flex h-full flex-col">
              <div className="relative flex-1 overflow-hidden rounded-lg">
                <AmapContainer
                  mapStyle="dark"
                  interactive={false}
                  fitView
                  center={data.center ? [data.center.lng, data.center.lat] : undefined}
                  markers={data.pois.map((p) => ({ lng: p.lng, lat: p.lat, title: p.name, tone: "success" as const, label: p.name }))}
                  fallback={
                    /* 降级:地图不可用时回 POI 列表(真实坐标) */
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-4" style={{ backgroundColor: "rgba(45,90,39,0.08)" }}>
                      <p className="text-[16px]" style={{ color: "var(--screen-text-dim)" }}>三维数字孪生导览底图</p>
                      <div className="grid w-full grid-cols-3 gap-1.5">
                        {data.pois.slice(0, 12).map((p) => (
                          <div key={p.name} className="flex items-center gap-1.5 rounded px-2 py-1 text-[12px]" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                            <span style={{ color: "var(--screen-glow)" }}>●</span>
                            <span className="truncate" style={{ color: "var(--screen-text)" }}>{p.name}</span>
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
              {/* 信息条 */}
              <div className="mt-2 flex items-center gap-6 rounded px-3 py-1.5 text-[12px]" style={{ backgroundColor: "var(--screen-card-bg)", color: "var(--screen-text-faint)" }}>
                <span>经纬度 {data.center ? `${data.center.lng.toFixed(3)}, ${data.center.lat.toFixed(3)}` : "—"}</span>
                <span>比例尺 1:5000</span>
                <span>当前模式：导览（3D 待接入）</span>
              </div>
            </div>
          </ScreenCard>

          {/* 底部图例 */}
          <div className="flex items-center gap-4 rounded-lg px-4 py-2.5 text-[13px]" style={{ backgroundColor: "var(--screen-card-bg)", border: "1px solid var(--screen-card-border)" }}>
            <span style={{ color: "var(--screen-text-dim)" }}>POI 分类图例：</span>
            {data.categories.length === 0 ? (
              <span style={{ color: "var(--screen-text-faint)" }}>暂无分类</span>
            ) : (
              data.categories.map((c, i) => (
                <span key={c} className="flex items-center gap-1.5" style={{ color: "var(--screen-text)" }}>
                  <span style={{ color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}>■</span>
                  {c}
                </span>
              ))
            )}
            <span className="ml-auto"><PlaceholderTag text="图层显隐筛选待接入" /></span>
          </div>
        </div>

        {/* 右:数字孪生面板 */}
        <div className="flex flex-col gap-3">
          <ScreenCard title="实时告警事件" className="flex-1">
            <div className="flex flex-col gap-1.5">
              {alerts.length === 0 ? (
                <p className="text-[14px]" style={{ color: "var(--screen-text-faint)" }}>暂无告警</p>
              ) : (
                alerts.slice(0, 5).map((a, i) => (
                  <div key={`${a.name}-${i}`} className="flex items-center gap-2 rounded px-2 py-1.5 text-[14px]" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                    <span style={{ color: ALERT_TONE[a.status] ?? "var(--screen-text-dim)" }}>●</span>
                    <span className="truncate" style={{ color: "var(--screen-text)" }}>{a.name}</span>
                    <span className="ml-auto text-[12px]" style={{ color: ALERT_TONE[a.status] ?? "var(--screen-text-dim)" }}>{ALERT_CN[a.status] ?? a.status}</span>
                  </div>
                ))
              )}
            </div>
          </ScreenCard>

          <ScreenCard title="重点设备实时读数">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <GaugeRing height={120} value={data.deviceOnlineRate} label="设备在线率" color="var(--screen-glow)" />
              </div>
              <div className="text-center">
                <GaugeRing height={120} value={data.parkingLoad} label="停车场负荷" />
              </div>
            </div>
            <p className="mt-1 text-center text-[12px]" style={{ color: "var(--screen-text-faint)" }}>
              闸机吞吐 / 路灯能耗 <PlaceholderTag text="专项传感器读数待接入" />
            </p>
          </ScreenCard>

          <ScreenCard title="设备运维统计">
            <div className="flex items-center justify-around">
              <div className="text-center">
                <p className="text-[32px] font-bold tabular-nums" style={{ color: "var(--screen-glow)" }}>{data.device.online}</p>
                <p className="text-[13px]" style={{ color: "var(--screen-text-dim)" }}>在线</p>
              </div>
              <div className="text-center">
                <p className="text-[32px] font-bold tabular-nums" style={{ color: "var(--screen-orange)" }}>{data.device.offline}</p>
                <p className="text-[13px]" style={{ color: "var(--screen-text-dim)" }}>离线</p>
              </div>
              <div className="text-center">
                <p className="text-[32px] font-bold tabular-nums" style={{ color: "var(--screen-red)" }}>{data.device.alert}</p>
                <p className="text-[13px]" style={{ color: "var(--screen-text-dim)" }}>告警</p>
              </div>
            </div>
          </ScreenCard>

          <ScreenCard title="在园人数 区域分布">
            <div className="flex h-full flex-col items-center justify-center gap-2 text-[14px]" style={{ color: "var(--screen-text-faint)" }}>
              需 POI 级在园计数
              <PlaceholderTag text="区域分布待接入" />
            </div>
          </ScreenCard>
        </div>
      </div>
    </div>
  );
}

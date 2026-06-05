"use client";

import { useEffect, useState } from "react";
import { BarList, type BarDatum } from "@/lib/ui/charts/BarList";
import { getScreenOccupancy } from "./_actions";

export interface SlotOccupancy {
  name: string;
  start: string;
  end: string;
  checkedIn: number;
  capacity: number;
}

export interface ParkingLotView {
  name: string;
  capacity: number;
  occupied: number;
  status: "OPEN" | "FULL" | "CLOSED" | string;
}

export interface BigScreenProps {
  scenicName: string;
  instantCapacity: number;
  initialOccupancy: number;
  todayBookings: number;
  device: { total: number; online: number; alert: number; offline: number };
  slots: SlotOccupancy[];
  dailyTraffic: BarDatum[];
  parkingLots: ParkingLotView[];
}

function useCnClock(): string {
  const [text, setText] = useState("");
  useEffect(() => {
    const fmt = () => {
      // 北京墙钟,避免大屏部署在异地服务器/浏览器导致偏差
      const parts = new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      setText(
        `${get("year")}年${get("month")}月${get("day")}日 ${get("weekday")} ${get("hour")}:${get("minute")}`,
      );
    };
    fmt();
    const id = setInterval(fmt, 15_000);
    return () => clearInterval(id);
  }, []);
  return text;
}

const PARKING_STATUS_CN: Record<string, string> = {
  OPEN: "空闲",
  FULL: "已满",
  CLOSED: "关闭",
};

export function BigScreen(props: BigScreenProps) {
  const { scenicName, instantCapacity, todayBookings, device, slots, dailyTraffic, parkingLots } = props;
  const [occupancy, setOccupancy] = useState(props.initialOccupancy);
  const [connected, setConnected] = useState(false);
  const clock = useCnClock();

  useEffect(() => {
    const es = new EventSource("/api/sse/checkin_event");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = () => {
      void getScreenOccupancy()
        .then((c) => setOccupancy(c))
        .catch(() => {});
    };
    return () => es.close();
  }, []);

  const pct = instantCapacity > 0 ? Math.round((occupancy / instantCapacity) * 100) : 0;
  const warn = pct >= 90; // 红线 4:达 90% 整屏闪红 + 已自动停预约
  const onlineRate = device.total > 0 ? Math.round((device.online / device.total) * 100) : 0;

  const slotBars: BarDatum[] = slots.map((s) => ({
    label: s.name,
    value: s.checkedIn,
    hint: `${s.checkedIn}/${s.capacity}`,
  }));

  return (
    <main
      className={`min-h-screen w-full p-8 text-white ${warn ? "animate-pulse" : ""}`}
      style={{ backgroundColor: warn ? "#7F1D1D" : "#0B1A2B" }}
    >
      {/* 顶部 */}
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wide">{scenicName} · 实时数据大屏</h1>
        <div className="flex items-center gap-5 text-sm">
          <span className="tabular-nums text-[#9CC4E4]">{clock}</span>
          <span className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? "animate-pulse bg-green-400" : "bg-gray-500"}`}
              role="img"
              aria-label={connected ? "实时连接正常" : "实时连接断开"}
            />
            {connected ? "实时连接正常" : "实时连接断开"}
          </span>
        </div>
      </header>

      {/* 承载预警横幅(非颜色冗余) */}
      {warn && (
        <div className="mb-6 rounded-lg border-2 border-red-300 bg-red-900/60 px-6 py-4 text-center">
          <p className="text-xl font-bold">⚠ 承载预警：在园人数已达瞬时承载量 90%，当日预约入口已自动暂停</p>
        </div>
      )}

      {/* KPI 瓦片 */}
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile
          title="在园人数 / 瞬时承载量"
          value={`${occupancy.toLocaleString("zh-CN")} / ${instantCapacity.toLocaleString("zh-CN")}`}
          sub={`占比 ${pct}%`}
          danger={warn}
        />
        <KpiTile title="今日预约总数" value={todayBookings.toLocaleString("zh-CN")} sub="人次" />
        <KpiTile
          title="设备在线率"
          value={`${onlineRate}%`}
          sub={`在线 ${device.online} · 告警 ${device.alert} · 离线 ${device.offline}`}
        />
        <KpiTile title="设备总数" value={device.total.toLocaleString("zh-CN")} sub="台" />
      </section>

      {/* 中部:客流趋势 + 分时段占用 */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="近 7 日客流趋势">
          <div className="rounded-lg bg-white p-4">
            <BarList data={dailyTraffic} height={260} emptyText="暂无客流数据" />
          </div>
        </Panel>
        <Panel title="今日分时段在园占用">
          <div className="rounded-lg bg-white p-4">
            <BarList data={slotBars} height={260} emptyText="今日暂无时段数据" />
          </div>
        </Panel>
      </section>

      {/* 底部:停车场(占位 + 数据表，地图待高德接入) */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="停车场分布地图">
          <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-[#345] bg-[#0F2236] text-sm text-[#6B8BAA]">
            地图待高德接入，当前以右侧数据表呈现
          </div>
        </Panel>
        <Panel title="停车场实时车位">
          <div className="overflow-auto rounded-lg bg-white">
            <table className="w-full text-sm text-[#1F2937]">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]">
                  <th className="px-3 py-2 text-left font-medium">停车场</th>
                  <th className="px-3 py-2 text-right font-medium">总车位</th>
                  <th className="px-3 py-2 text-right font-medium">占用</th>
                  <th className="px-3 py-2 text-right font-medium">剩余</th>
                  <th className="px-3 py-2 text-left font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {parkingLots.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[#9CA3AF]">暂无停车场数据</td>
                  </tr>
                ) : (
                  parkingLots.map((lot) => (
                    <tr key={lot.name} className="border-b border-[#F3F4F6] last:border-0">
                      <td className="px-3 py-2 font-medium">{lot.name}</td>
                      <td className="px-3 py-2 text-right">{lot.capacity}</td>
                      <td className="px-3 py-2 text-right">{lot.occupied}</td>
                      <td className="px-3 py-2 text-right">{Math.max(0, lot.capacity - lot.occupied)}</td>
                      <td className="px-3 py-2">{PARKING_STATUS_CN[lot.status] ?? lot.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    </main>
  );
}

function KpiTile({
  title,
  value,
  sub,
  danger,
}: {
  title: string;
  value: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <div
      className="rounded-xl border px-5 py-4"
      style={{
        backgroundColor: danger ? "rgba(220,38,38,0.25)" : "rgba(255,255,255,0.06)",
        borderColor: danger ? "#FCA5A5" : "rgba(255,255,255,0.12)",
      }}
    >
      <p className="text-[13px] text-[#9CC4E4]">{title}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-[#9CC4E4]">{sub}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-[#9CC4E4]">{title}</h2>
      {children}
    </div>
  );
}

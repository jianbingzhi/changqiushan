"use client";

// T1d(2026-06-04 用户决策):实时路况整页地图 + 数据浮层。
// 浮层骨架(根容器/KPI 玻璃卡/图例/可折叠面板/窄视口收起)收口在 lib/ui/map/map-overlay,
// 与 parking 页共用(b-103 评审 #10);本文件只留路况业务内容。
// 浮层:① 左上 KPI 玻璃卡(页标题融入) ② 右侧 360px 可折叠面板(B10 摘要 + a11y 数据表) ③ 左下图例。

import { useState } from "react";

import { AmapContainer } from "@/lib/ui/map/AmapContainer";
import { MapPageShell, MapKpiCard, MapLegend, MapSidePanel, useMapPanelOpen } from "@/lib/ui/map/map-overlay";
import { EmptyState } from "@/lib/ui/empty-state";
import { StatusChip } from "@/lib/ui/status-chip";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { formatCnDateTime } from "@/shared/format";
import type { RoadConditionsResult, TrafficCondition } from "@/modules/traffic";

const CHIP_KEY: Record<TrafficCondition["congestion"], "ROAD_SMOOTH" | "ROAD_SLOW" | "ROAD_JAM"> = {
  畅通: "ROAD_SMOOTH",
  缓行: "ROAD_SLOW",
  拥堵: "ROAD_JAM",
};

// 图例与高德路况瓦片层配色一一对应(畅通绿/缓行橙/拥堵红,语义 token 随主题切换)
const LEGEND = [
  ["畅通", "bg-success"],
  ["缓行", "bg-warning"],
  ["拥堵", "bg-danger"],
] as const;

const TABS = [
  { key: "summary", label: "摘要" },
  { key: "table", label: "数据表" },
] as const;

function Kpi({ label, value, dotClass }: { label: string; value: number | null; dotClass: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[15px] font-bold tabular-nums text-foreground">{value ?? "—"}</span>
      <span className="text-[12px] text-muted-foreground">条</span>
    </div>
  );
}

export function RoadMap({ source, conditions }: RoadConditionsResult) {
  const [panelOpen, setPanelOpen] = useMapPanelOpen();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("summary");

  // 审计 P2-5:数据源未接通时 KPI 显示「—」而非误导性 0
  const live = source === "amap";
  const free = live ? conditions.filter((c) => c.congestion === "畅通").length : null;
  const slow = live ? conditions.filter((c) => c.congestion === "缓行").length : null;
  const jam  = live ? conditions.filter((c) => c.congestion === "拥堵").length : null;
  const updatedAt = conditions[0]?.updatedAt ? formatCnDateTime(new Date(conditions[0].updatedAt)) : "—";

  // 诚实三态空态文案:未配置 / 服务异常 / 已接通但矩形内无路况(沿用原页面口径)
  const emptyMessage =
    source === "unconfigured"
      ? "高德地图 Key 未配置,暂无路况数据"
      : source === "error"
        ? "高德路况服务暂不可用(请检查 Key 或网络)"
        : "暂无路况数据";

  return (
    <MapPageShell>
      {/* 地图铺底:traffic 开启高德实时路况瓦片层,视觉不依赖 REST 数据;error 态兜底沿用诚实占位 */}
      <AmapContainer
        traffic
        className="absolute inset-0"
        fallback={
          <div className="flex h-full items-center justify-center bg-muted">
            <p className="text-[13px] text-muted-foreground">{emptyMessage}</p>
          </div>
        }
      />

      <MapKpiCard
        title="实时路况查询"
        subtitle="景区周边路况与分流建议"
        footnote={!live ? emptyMessage : undefined}
      >
        <Kpi label="畅通" value={free} dotClass="bg-success" />
        <Kpi label="缓行" value={slow} dotClass="bg-warning" />
        <Kpi label="拥堵" value={jam} dotClass="bg-danger" />
        {/* round-01 N07:显示的是高德返回的取数时刻(响应头 Date),不是本次渲染时刻;
            路况有约 1 分钟缓存,同一分钟内连续访问会看到同一个时间,属预期。 */}
        <div className="flex items-center gap-1.5" title="路况数据缓存约 1 分钟;此处为高德返回的取数时刻">
          <span className="text-[12px] text-muted-foreground">最后更新</span>
          <span className="text-[13px] font-medium text-foreground">{live ? updatedAt : "—"}</span>
        </div>
      </MapKpiCard>

      <MapLegend ariaLabel="路况图例" items={LEGEND} dotClass="h-1.5 w-4 rounded-full" />

      <MapSidePanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title="拥堵摘要"
        tablistLabel="路况数据视图"
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
      >
        {conditions.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : tab === "summary" ? (
          <ul className="divide-y divide-border">
            {conditions.map((c, i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] font-medium text-foreground">{c.name}</p>
                  <StatusChip status={CHIP_KEY[c.congestion]} />
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{c.description}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {c.updatedAt ? formatCnDateTime(new Date(c.updatedAt)) : "—"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          /* a11y 数据表:列与口径与原页面完全一致 */
          <Table density="compact">
            <TableHeader>
              <TableRow className="bg-muted/50">
                {["路段名", "拥堵等级", "描述", "更新时间"].map((h) => (
                  <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {conditions.map((c, i) => (
                <TableRow key={i} className="hover:bg-muted/50">
                  <TableCell className="text-[13px] font-medium text-foreground">{c.name}</TableCell>
                  <TableCell><StatusChip status={CHIP_KEY[c.congestion]} /></TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{c.description}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{c.updatedAt ? formatCnDateTime(new Date(c.updatedAt)) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </MapSidePanel>
    </MapPageShell>
  );
}

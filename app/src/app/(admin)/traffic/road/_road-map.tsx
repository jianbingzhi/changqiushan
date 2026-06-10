"use client";

// T1d(2026-06-04 用户决策):实时路况整页地图 + 数据浮层。
// 布局逃逸:admin shell 的 main 是 flex-1 overflow-y-auto p-6、topbar h-16,
// 根 div 用 -m-6 + h-[calc(100vh-4rem)] 抵消内边距,让高德路况瓦片铺满整页。
// 浮层:① 左上 KPI 玻璃卡(页标题融入) ② 右侧 360px 可折叠面板(B10 摘要 + a11y 数据表) ③ 左下图例。

import { useEffect, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

import { AmapContainer } from "@/lib/ui/map/AmapContainer";
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
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<"summary" | "table">("summary");

  // 审计 P2-7:窄视口(内容区 <840px)下面板会盖住 KPI 卡——水合后下一帧收起
  // (SSR 始终渲染展开态避免水合不一致;rAF 延迟避开 effect 内同步 setState)
  useEffect(() => {
    if (window.innerWidth >= 1280) return;
    const id = requestAnimationFrame(() => setPanelOpen(false));
    return () => cancelAnimationFrame(id);
  }, []);

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

  const tabBtn = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <div className="relative -m-6 h-[calc(100vh-4rem)] overflow-hidden">
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

      {/* ① 左上 KPI 玻璃卡(整页地图模式下页标题融入此卡) */}
      <section className="absolute left-4 top-4 z-20 max-w-[calc(100%-2rem)] rounded-lg border border-border bg-card/85 px-4 py-3 shadow-sm backdrop-blur">
        <h1 className="text-[16px] font-bold leading-tight text-foreground">实时路况查询</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">景区周边路况与分流建议</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <Kpi label="畅通" value={free} dotClass="bg-success" />
          <Kpi label="缓行" value={slow} dotClass="bg-warning" />
          <Kpi label="拥堵" value={jam} dotClass="bg-danger" />
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-muted-foreground">最后更新</span>
            <span className="text-[13px] font-medium text-foreground">{live ? updatedAt : "—"}</span>
          </div>
        </div>
        {!live && <p className="mt-1.5 text-[12px] text-muted-foreground">{emptyMessage}</p>}
      </section>

      {/* ③ 左下图例 */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-lg border border-border bg-card/85 px-3 py-2 backdrop-blur" aria-label="路况图例">
        {LEGEND.map(([label, cls]) => (
          <span key={label} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className={`h-1.5 w-4 rounded-full ${cls}`} aria-hidden />
            {label}
          </span>
        ))}
      </div>

      {/* ② 右侧可折叠数据面板(B10 拥堵摘要 + a11y 数据表) */}
      {panelOpen ? (
        <section className="absolute bottom-4 right-4 top-4 z-20 flex w-[360px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-card/85 shadow-sm backdrop-blur">
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <h2 className="text-[14px] font-semibold text-foreground">拥堵摘要</h2>
            <div className="flex items-center gap-1" role="tablist" aria-label="路况数据视图">
              <button type="button" role="tab" aria-selected={tab === "summary"} className={tabBtn(tab === "summary")} onClick={() => setTab("summary")}>摘要</button>
              <button type="button" role="tab" aria-selected={tab === "table"} className={tabBtn(tab === "table")} onClick={() => setTab("table")}>数据表</button>
              <button
                type="button"
                aria-label="收起数据面板"
                aria-expanded={true}
                className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setPanelOpen(false)}
              >
                <PanelRightClose className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto" role="tabpanel">
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
          </div>
        </section>
      ) : (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setPanelOpen(true)}
          className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-lg border border-border bg-card/85 px-3 py-2 text-[13px] font-medium text-foreground shadow-sm backdrop-blur hover:bg-muted"
        >
          <PanelRightOpen className="h-4 w-4" aria-hidden />
          展开数据面板
        </button>
      )}
    </div>
  );
}

"use client";

// T1d(2026-06-04 用户决策):停车场整页地图 + 数据浮层。
// P 标记:OPEN→success(绿)/FULL→danger(红)/CLOSED→warning(橙),label「名称 余位/总数」;
// 无坐标的停车场不上图,在概览卡片上标注「未配置坐标」。
// 浮层:① 左上 KPI 玻璃卡(页标题融入) ② 右侧面板 Tab「概览/管理」(B11 卡片堆叠 + a11y 表 + 原 CRUD 表单) ③ 左下图例。

import { useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

import { AmapContainer, type AmapMarkerInput } from "@/lib/ui/map/AmapContainer";
import { EmptyState } from "@/lib/ui/empty-state";
import { StatusChip } from "@/lib/ui/status-chip";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { ParkingForm, type ParkingLotRow } from "./_parking-form";

/** 面板/标记消费的行:CRUD 行(ParkingLotRow)+ 占用数 + 服务端格式化的更新时间 */
export type ParkingLotView = ParkingLotRow & { occupied: number; updatedAtText: string };

const MARKER_TONE: Record<ParkingLotRow["status"], NonNullable<AmapMarkerInput["tone"]>> = {
  OPEN: "success",
  FULL: "danger",
  CLOSED: "warning",
};

const CHIP_KEY: Record<ParkingLotRow["status"], "LOT_OPEN" | "LOT_FULL" | "LOT_CLOSED"> = {
  OPEN: "LOT_OPEN",
  FULL: "LOT_FULL",
  CLOSED: "LOT_CLOSED",
};

// P 标记三色图例(语义 token 随主题切换)
const LEGEND = [
  ["开放", "bg-success"],
  ["满位", "bg-danger"],
  ["关闭", "bg-warning"],
] as const;

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[15px] font-bold tabular-nums text-foreground">{value}</span>
      <span className="text-[12px] text-muted-foreground">个</span>
    </div>
  );
}

export function ParkingMap({ lots }: { lots: ParkingLotView[] }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<"overview" | "manage">("overview");

  const totalSpaces   = lots.reduce((s, p) => s + p.capacity, 0);
  const totalOccupied = lots.reduce((s, p) => s + p.occupied, 0);
  const fullCount     = lots.filter((p) => p.status === "FULL").length;

  // 仅有合法坐标的停车场上图;label「名称 余位/总数」
  const markers: AmapMarkerInput[] = lots
    .filter((l) => l.lng != null && l.lat != null)
    .map((l) => ({
      lng: l.lng as number,
      lat: l.lat as number,
      title: l.name,
      tone: MARKER_TONE[l.status],
      label: `${l.name} ${l.capacity - l.occupied}/${l.capacity}`,
    }));

  const tabBtn = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <div className="relative -m-6 h-[calc(100vh-4rem)] overflow-hidden">
      {/* 地图铺底:P 标记 + 有标记时 fitView 自动取景 */}
      <AmapContainer
        markers={markers}
        fitView={markers.length > 0}
        className="absolute inset-0"
        fallback={
          <div className="flex h-full items-center justify-center bg-muted">
            <p className="text-[13px] text-muted-foreground">停车场分布地图暂无法展示,数据请见右侧面板</p>
          </div>
        }
      />

      {/* ① 左上 KPI 玻璃卡(整页地图模式下页标题融入此卡) */}
      <section className="absolute left-4 top-4 z-20 max-w-[calc(100%-2rem)] rounded-lg border border-border bg-card/85 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[16px] font-bold leading-tight text-foreground">停车场动静态上图</h1>
          <span className="text-[12px] text-muted-foreground">数据定时刷新</span>
        </div>
        <p className="mt-0.5 text-[12px] text-muted-foreground">景区停车场状态监控</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <Kpi label="总车位" value={totalSpaces} />
          <Kpi label="当前占用" value={totalOccupied} />
          <Kpi label="剩余车位" value={totalSpaces - totalOccupied} />
          <Kpi label="满场数" value={fullCount} />
        </div>
      </section>

      {/* ③ 左下图例(P 标记三色) */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-lg border border-border bg-card/85 px-3 py-2 backdrop-blur" aria-label="停车场标记图例">
        {LEGEND.map(([label, cls]) => (
          <span key={label} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className={`h-2.5 w-2.5 rounded-full border border-card ${cls}`} aria-hidden />
            {label}
          </span>
        ))}
      </div>

      {/* ② 右侧可折叠面板:概览(B11 卡片堆叠 + a11y 表)/ 管理(原 CRUD 表单完整保留) */}
      {panelOpen ? (
        <section className="absolute bottom-4 right-4 top-4 z-20 flex w-[360px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-card/85 shadow-sm backdrop-blur">
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <h2 className="text-[14px] font-semibold text-foreground">停车场数据</h2>
            <div className="flex items-center gap-1">
              <button type="button" className={tabBtn(tab === "overview")} onClick={() => setTab("overview")}>概览</button>
              <button type="button" className={tabBtn(tab === "manage")} onClick={() => setTab("manage")}>管理</button>
              <button
                type="button"
                aria-label="收起数据面板"
                className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setPanelOpen(false)}
              >
                <PanelRightClose className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-3">
            {tab === "manage" ? (
              <ParkingForm lots={lots} />
            ) : lots.length === 0 ? (
              <EmptyState message="暂无停车场数据,请切到「管理」页签录入停车场信息" />
            ) : (
              <>
                {/* B11 停车卡堆叠:名称 / 状态 Chip / 余位进度条 */}
                <ul className="space-y-2.5">
                  {lots.map((lot) => {
                    const remaining = lot.capacity - lot.occupied;
                    const ratio = lot.capacity > 0 ? Math.min(lot.occupied / lot.capacity, 1) : 0;
                    const barCls = ratio >= 1 ? "bg-danger" : ratio >= 0.8 ? "bg-warning" : "bg-success";
                    return (
                      <li key={lot.id} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] font-medium text-foreground">{lot.name}</p>
                          <StatusChip status={CHIP_KEY[lot.status]} />
                        </div>
                        <div
                          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={lot.capacity}
                          aria-valuenow={lot.occupied}
                          aria-label={`${lot.name}车位占用进度`}
                        >
                          <div className={`h-full rounded-full ${barCls}`} style={{ width: `${ratio * 100}%` }} />
                        </div>
                        <p className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                          <span>
                            余位 <span className={`font-medium tabular-nums ${remaining === 0 ? "text-danger" : "text-foreground"}`}>{remaining}</span> / {lot.capacity}
                          </span>
                          {(lot.lng == null || lot.lat == null) && <span className="text-warning">未配置坐标,未上图</span>}
                        </p>
                      </li>
                    );
                  })}
                </ul>

                {/* a11y 数据表:列与口径与原页面完全一致 */}
                <div className="mt-3 rounded-lg border border-border bg-card">
                  <Table density="compact">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        {["停车场名称", "总车位", "已占用", "剩余", "状态", "更新时间"].map((h) => (
                          <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lots.map((lot) => {
                        const remaining = lot.capacity - lot.occupied;
                        return (
                          <TableRow key={lot.id} className="hover:bg-muted/50">
                            <TableCell className="text-[13px] font-medium text-foreground">{lot.name}</TableCell>
                            <TableCell className="text-[12px] tabular-nums text-muted-foreground">{lot.capacity}</TableCell>
                            <TableCell className="text-[12px] tabular-nums text-muted-foreground">{lot.occupied}</TableCell>
                            <TableCell className={`text-[12px] font-medium tabular-nums ${remaining === 0 ? "text-danger" : "text-foreground"}`}>{remaining}</TableCell>
                            <TableCell><StatusChip status={CHIP_KEY[lot.status]} /></TableCell>
                            <TableCell className="text-[12px] text-muted-foreground">{lot.updatedAtText}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </section>
      ) : (
        <button
          type="button"
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

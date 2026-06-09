"use client";

import * as React from "react";
import type { EChartsOption } from "echarts";
import { echarts } from "@/lib/ui/screen/echarts-setup";
import { EChart } from "@/lib/ui/screen/charts/EChart";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import chinaGeo from "@/lib/ui/geo/china-provinces.json";
import { getRegionDataAction, type RegionDatum } from "./actions";

// B33 来源行政图(PRD1.4):省级 choropleth(离线 GeoJSON)→ 点省下钻市/区县(DataV 懒加载,不依赖高德 key)
// + 面包屑 + 等价数据表(a11y/兜底)。数据按区划名匹配地图;身份证签发地≈籍贯近似。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoJson = any;

echarts.registerMap("china", chinaGeo as GeoJson);

const DATAV = (adcode: string) => `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`;

function nameToAdcode(geo: GeoJson): Record<string, string> {
  const m: Record<string, string> = {};
  for (const f of geo.features ?? []) {
    if (f?.properties?.name) m[f.properties.name] = String(f.properties.adcode);
  }
  return m;
}

type Level = "province" | "city" | "district";
type Frame = { name: string; mapName: string; level: Level; data: RegionDatum[]; geo: GeoJson };

export function RegionMap({ provinceData }: { provinceData: RegionDatum[] }) {
  const [stack, setStack] = React.useState<Frame[]>([
    { name: "全国", mapName: "china", level: "province", data: provinceData, geo: chinaGeo },
  ]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const cur = stack[stack.length - 1];
  const maxVal = Math.max(1, ...cur.data.map((d) => d.visitorCount));

  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: (p) => {
        const d = p as { name?: string; value?: number };
        return `${d.name ?? ""}<br/>到访游客 ${Number.isFinite(d.value) ? d.value : 0} 人`;
      },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      left: "left",
      bottom: 16,
      calculable: true,
      text: ["多", "少"],
      textStyle: { color: "#6B7280" },
      inRange: { color: ["#EAF6EC", "#A5D6A7", "#66BB6A", "#388E3C", "#1B5E20"] },
    },
    series: [
      {
        type: "map",
        map: cur.mapName,
        roam: false,
        label: { show: false },
        emphasis: { label: { show: true }, itemStyle: { areaColor: "#FFD54F" } },
        itemStyle: { borderColor: "#FFFFFF", borderWidth: 0.5, areaColor: "#F3F4F6" },
        data: cur.data.map((d) => ({ name: d.name, value: d.visitorCount })),
      },
    ],
  };

  async function drillTo(adcode: string, name: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(DATAV(adcode));
      if (!res.ok) throw new Error("geojson");
      const geo: GeoJson = await res.json();
      const childLevel: string = geo.features?.[0]?.properties?.level ?? "district";
      let dataLevel: Level;
      let parentCode: string;
      if (childLevel === "city") {
        dataLevel = "city";
        parentCode = adcode.slice(0, 2);
      } else {
        dataLevel = "district";
        // 直辖市省级 adcode=XX0000 → 市辖区码 XX01;普通市 adcode=XXYY00 → XXYY
        parentCode = adcode.slice(2, 4) === "00" ? adcode.slice(0, 2) + "01" : adcode.slice(0, 4);
      }
      const data = await getRegionDataAction(dataLevel, parentCode);
      echarts.registerMap(adcode, geo);
      setStack((s) => [...s, { name, mapName: adcode, level: dataLevel, data, geo }]);
    } catch {
      setError("地图数据加载失败，请查看下方数据表");
    } finally {
      setLoading(false);
    }
  }

  const onEvents = {
    click: (params: unknown) => {
      if (loading || cur.level === "district") return;
      const name = (params as { name?: string }).name;
      if (!name) return;
      const adcode = nameToAdcode(cur.geo)[name];
      if (adcode) void drillTo(adcode, name);
    },
  };

  const popTo = (i: number) => setStack((s) => s.slice(0, i + 1));

  const sortedData = [...cur.data].sort((a, b) => b.visitorCount - a.visitorCount);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* 面包屑 */}
      <div className="mb-2 flex flex-wrap items-center gap-1 text-[13px]">
        {stack.map((f, i) => (
          <span key={f.mapName + i} className="flex items-center gap-1">
            {i > 0 && <span className="text-text-muted">/</span>}
            {i < stack.length - 1 ? (
              <button type="button" onClick={() => popTo(i)} className="text-primary hover:underline">
                {f.name}
              </button>
            ) : (
              <span className="font-medium text-foreground">{f.name}</span>
            )}
          </span>
        ))}
        {cur.level !== "district" && (
          <span className="ml-2 text-[12px] text-text-muted">点击地图区域下钻</span>
        )}
      </div>

      {error && <p className="mb-2 text-[12px] text-danger">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* 地图 */}
        <div className="relative min-h-80">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 text-[13px] text-muted-foreground">
              加载中…
            </div>
          )}
          <EChart option={option} theme={null} height={360} onEvents={onEvents} />
        </div>

        {/* 等价数据表 */}
        <div className="overflow-auto rounded-md border border-border">
          <Table density="compact">
            <TableHeader>
              <TableRow className="bg-muted">
                {["地区", "到访游客"].map((h) => (
                  <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="p-0"><EmptyState message="暂无该层级到访数据" /></TableCell></TableRow>
              ) : sortedData.map((d) => (
                <TableRow key={d.code} className="hover:bg-muted">
                  <TableCell className="text-[13px] text-foreground">{d.name}</TableCell>
                  <TableCell className="text-[13px]">{d.visitorCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-text-muted">口径:按身份证签发地聚合(≈籍贯近似),已去重到访游客;未知码归「未知」。</p>
    </div>
  );
}

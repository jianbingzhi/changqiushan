"use client";

import { KpiTile } from "@/lib/ui/screen/KpiTile";
import { useScreenPoll } from "@/lib/ui/screen/use-screen-poll";

// occupancy 端点返回形状的子集(只取大屏此卡所需字段;多余字段忽略)。
interface OccData {
  occupancy: number;
  capacity: number;
  pct: number;
}

// C5「当前在园人数」:与「今日累计入园核销」同源(系统无出园核销,在园≈累计入园),
// 故必须 ① 轮询保持实时(挂墙不刷新页面)② 文案标注"累计近似",避免两卡同值被误读为复制 bug。
export function OverviewOccupancy({ initial }: { initial: OccData }) {
  const { data } = useScreenPoll<OccData>("occupancy", initial, 15_000);
  const { occupancy, capacity, pct } = data;

  return (
    <KpiTile
      title="当前在园人数"
      value={occupancy.toLocaleString("zh-CN")}
      unit="人"
      valueSize={44}
      danger={pct >= 90}
      tone={pct >= 80 ? "warn" : "primary"}
      sub={
        pct >= 90 ? (
          <span style={{ color: "var(--screen-red)" }}>
            ⚠ 承载率 {pct}% · 已达熔断阈值 · 已停当日预约
          </span>
        ) : (
          `承载率 ${pct}% / 红线 ${capacity.toLocaleString("zh-CN")} 人 · 累计入园近似（无出园核销）`
        )
      }
    />
  );
}

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import { createParkingLotSchema } from "./schema";

// round-01 N11 防回归:种子里 4 个停车场坐标全为 NULL,`/traffic/parking` 整页地图 0/4 上图,
// 「上图」这个功能从来没被任何人看见过。缺陷不在代码在数据,所以守卫也守数据:
// 把 seed 里那份停车场清单读出来,拿**生产用的同一个 zod schema** 校验,再核对 SQL 真写了 coordinates。

const seed = readFileSync(fileURLToPath(new URL("../../../../prisma/seed.ts", import.meta.url)), "utf8");

// 园区骨架(GCJ-02,同 POI 那套):中心 103.6147, 30.2317。
// 容差 0.05°(约 5 公里)——经纬写反、少写一位、抄成别的景区,都会掉出这个框。
const PARK_CENTER = { lng: 103.6147, lat: 30.2317 };
const PARK_TOLERANCE = 0.05;

interface SeedLot {
  name: string;
  lng: number;
  lat: number;
}

function seedParkingLots(): SeedLot[] {
  const block = /const lots = \[([\s\S]*?)\n {4}\];/.exec(seed);
  expect(block, "seed.ts 里找不到停车场清单 `const lots = [...]`").not.toBeNull();
  const lots: SeedLot[] = [];
  const row = /name:\s*"([^"]+)"[^}]*?lng:\s*([\d.]+),\s*lat:\s*([\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = row.exec(block![1]))) lots.push({ name: m[1], lng: Number(m[2]), lat: Number(m[3]) });
  return lots;
}

describe("N11 种子里的停车场必须带坐标(否则整页地图 0 标点)", () => {
  const lots = seedParkingLots();

  it("4 个停车场全部配了经纬度", () => {
    expect(lots.map((l) => l.name)).toEqual([
      "西门停车场",
      "游客中心地下车库",
      "主峰临时停车场",
      "东门生态停车场",
    ]);
  });

  it.each(lots.map((l) => [l.name, l] as const))("%s 的坐标能过生产校验且落在园区范围内", (_name, lot) => {
    // 用页面/表单实际走的那条校验,而不是另写一套判断
    const parsed = createParkingLotSchema.safeParse({
      name: lot.name,
      capacity: 100,
      status: "OPEN",
      coordinates: { lng: lot.lng, lat: lot.lat },
    });
    expect(parsed.success).toBe(true);
    expect(Math.abs(lot.lng - PARK_CENTER.lng)).toBeLessThan(PARK_TOLERANCE);
    expect(Math.abs(lot.lat - PARK_CENTER.lat)).toBeLessThan(PARK_TOLERANCE);
  });

  it("四个点两两不重合(重合会在地图上叠成一个标记)", () => {
    const keys = new Set(lots.map((l) => `${l.lng.toFixed(4)},${l.lat.toFixed(4)}`));
    expect(keys.size).toBe(lots.length);
  });

  it("INSERT 写入 coordinates,且 ON CONFLICT 会覆盖它(否则老库重跑 seed 仍是 NULL)", () => {
    const sql = /INSERT INTO traffic_parking_lot[\s\S]*?`/.exec(seed)?.[0] ?? "";
    expect(sql).toMatch(/INSERT INTO traffic_parking_lot \([^)]*coordinates/);
    expect(sql).toMatch(/ON CONFLICT \(name\) DO UPDATE SET[\s\S]*coordinates=EXCLUDED\.coordinates/);
  });
});

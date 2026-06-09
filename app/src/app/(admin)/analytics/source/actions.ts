"use server";

import { analyticsService, type RegionLevel } from "@/modules/analytics";
import { requireRole, ANY_STAFF } from "@/infrastructure/auth/guard";

export type RegionDatum = { code: string; name: string; visitorCount: number };

// B33 来源行政图下钻取数:level=province/city/district,parentCode 限定上级(省码2位/市码4位)。
export async function getRegionDataAction(
  level: RegionLevel,
  parentCode?: string,
): Promise<RegionDatum[]> {
  const auth = await requireRole(ANY_STAFF);
  if (!auth.ok) return [];
  const res = await analyticsService.getVisitorRegions(level, parentCode);
  return res.ok ? res.value : [];
}

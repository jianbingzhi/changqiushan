import { trafficRepository } from "@/modules/traffic";
import { formatCnDateTime } from "@/shared/format";
import { ParkingMap, type ParkingLotView } from "./_parking-map";

export const dynamic = "force-dynamic";
export const metadata = { title: "停车场动静态上图 · 长秋山管理后台" };

// lot.coordinates 是 Json 字段({lng,lat}|null),宽松解析,非法值一律置 null(无坐标不上图)。
function toCoord(value: unknown): { lng: number | null; lat: number | null } {
  if (value && typeof value === "object" && "lng" in value && "lat" in value) {
    const v = value as { lng: unknown; lat: unknown };
    return {
      lng: typeof v.lng === "number" ? v.lng : null,
      lat: typeof v.lat === "number" ? v.lat : null,
    };
  }
  return { lng: null, lat: null };
}

// T1d(2026-06-04 用户决策):整页高德地图铺底 + 数据浮层。RSC 只负责取数与序列化。
export default async function TrafficParkingPage() {
  const lots = await trafficRepository.listParkingLots().catch(() => []);

  const rows: ParkingLotView[] = lots.map((lot) => {
    const { lng, lat } = toCoord(lot.coordinates);
    return {
      id: lot.id,
      name: lot.name,
      capacity: lot.capacity,
      occupied: lot.occupied,
      status: lot.status,
      location: lot.location,
      lng,
      lat,
      updatedAtText: formatCnDateTime(lot.updatedAt),
    };
  });

  return <ParkingMap lots={rows} />;
}

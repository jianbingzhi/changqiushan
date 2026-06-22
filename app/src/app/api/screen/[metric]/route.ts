import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { bookingService } from "@/modules/booking";
import { iotRepository } from "@/modules/iot";
import { trafficRepository } from "@/modules/traffic";
import { analyticsRepository } from "@/modules/analytics";
import { configService } from "@/modules/system";
import { fetchWeather } from "@/infrastructure/amap";
import { resolveInstantCapacity, CIRCUIT_BREAK_RATIO } from "@/shared/lib/capacity";
import { buildDispatch, PARKING_FULL_RATIO } from "@/shared/lib/dispatch";
import { chinaToday } from "@/shared/lib/time";
import { screenGatePassed } from "@/shared/auth/screen-gate";

// 大屏公开只读轮询端点。/api/* 不过 middleware → 软门在此自校验。
// PII 白名单铁律:只出聚合 / 计数 / 状态枚举,绝不返回 Booking/黑名单/申诉 原始行。
export const dynamic = "force-dynamic";

const TTL_MS = 15_000;
const cache = new Map<string, { at: number; data: unknown }>();

// 调度阈值常量见 @/shared/lib/dispatch(DISPATCH_WARN_PCT / PARKING_FULL_RATIO),页面与本端点共用。

// occupancy 与 slots 共用同一份「今日时段」取数:派生读内部是 4 个查询,两 metric 各自
// 缓存 miss 时会翻倍打 DB——共享一层 15s memo,同窗只取一次(b-103 评审附注)。
let slotsMemo: { at: number; data: Awaited<ReturnType<typeof bookingService.listSlotsForDate>> } | null = null;
async function todaySlots() {
  const now = Date.now();
  if (slotsMemo && now - slotsMemo.at < TTL_MS) return slotsMemo.data;
  const data = await bookingService.listSlotsForDate(chinaToday()).catch(() => []);
  slotsMemo = { at: now, data };
  return data;
}

// ── 指标白名单:每个 metric → PII-free 聚合 resolver ──────────────────────────
const RESOLVERS: Record<string, () => Promise<unknown>> = {
  // 在园 / 承载 / 熔断(90% 闪红的数据源)
  occupancy: async () => {
    const [slots, capacity] = await Promise.all([
      todaySlots(),
      configService.getInstantCapacity().catch(() => resolveInstantCapacity()),
    ]);
    const occupancy = slots.reduce((s, sl) => s + sl.checkedInCount, 0);
    const bookings = slots.reduce((s, sl) => s + sl.bookedCount, 0);
    const pct = capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0;
    return {
      occupancy,
      capacity,
      bookings,
      pct,
      circuitBroken: pct >= CIRCUIT_BREAK_RATIO * 100,
      paused: slots.some((s) => s.status === "PAUSED"),
    };
  },

  // 今日各时段占用(名称/容量/已约/在园/状态枚举)
  slots: async () => {
    const slots = await todaySlots();
    return slots.map((s) => ({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      capacity: s.capacity,
      booked: s.bookedCount,
      checkedIn: s.checkedInCount,
      status: s.status,
    }));
  },

  // 设备在线计数
  devices: async () => {
    const devices = await iotRepository.listDevices().catch(() => []);
    return {
      total: devices.length,
      online: devices.filter((d) => d.status === "ONLINE").length,
      alert: devices.filter((d) => d.status === "ALERT").length,
      offline: devices.filter((d) => d.status === "OFFLINE").length,
    };
  },

  // 停车场聚合(名称/容量/占用/状态)
  parking: async () => {
    const lots = await trafficRepository.listParkingLots().catch(() => []);
    return lots.map((l) => ({
      name: l.name,
      capacity: l.capacity,
      occupied: l.occupied,
      remaining: Math.max(0, l.capacity - l.occupied),
      status: l.status,
    }));
  },

  // 告警事件(设备名/位置/状态枚举 —— 无访客 PII)
  alerts: async () => {
    const devices = await iotRepository.listDevices().catch(() => []);
    return devices
      .filter((d) => d.status === "ALERT" || d.status === "OFFLINE")
      .map((d) => ({ name: d.name, location: d.location, status: d.status, lastSeen: d.lastSeen }));
  },

  // 顶栏实时天气(高德 weatherInfo;诚实三态,不含 AQI)。
  weather: async () => fetchWeather(),

  // 今日游客画像雷达(5 轴,全部来自现有聚合查询;0~100 整数百分比)。
  // 男性/青年来自身份证派生画像,自驾/午前来自出行偏好,本市占比按城市去重计数算。
  profileRadar: async () => {
    const [profile, travel, cities] = await Promise.all([
      analyticsRepository.getProfileOverview().catch(() => []),
      analyticsRepository.getTravelPreference().catch(() => []),
      analyticsRepository.getVisitorRegionByCity().catch(() => []),
    ]);
    const pct = (rows: { dimension: string; percentage: number }[], dim: string) => {
      const row = rows.find((r) => r.dimension === dim);
      return row ? Math.round(row.percentage) : 0;
    };
    const totalCity = cities.reduce((s, c) => s + Number(c.visitor_count), 0);
    const chengdu = cities.find((c) => c.code === "5101" || c.name.includes("成都"));
    const localPct =
      totalCity > 0 && chengdu ? Math.round((Number(chengdu.visitor_count) / totalCity) * 100) : 0;
    return {
      axes: [
        { key: "male",      label: "男性占比",     value: pct(profile, "性别·男") },
        { key: "youth",     label: "青年(18-30)", value: pct(profile, "年龄·18-30岁") },
        { key: "local",     label: "本市(成都)",   value: localPct },
        { key: "selfDrive", label: "自驾出行",     value: pct(travel, "出行·自驾") },
        { key: "morning",   label: "午前入园",     value: pct(travel, "时段·上午(12时前)") },
      ],
    };
  },

  // 智能调度策略(规则模板,非 AI):按真实态势触发,平时空态、特殊时给可执行编号策略。
  // 纯展示,无执行动作(actuator)——供人工按策略执行。
  dispatch: async () => {
    const [slots, capacity, lots, devices] = await Promise.all([
      todaySlots(),
      configService.getInstantCapacity().catch(() => resolveInstantCapacity()),
      trafficRepository.listParkingLots().catch(() => []),
      iotRepository.listDevices().catch(() => []),
    ]);
    const occupancy = slots.reduce((s, sl) => s + sl.checkedInCount, 0);
    const pct = capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0;

    const result = buildDispatch({
      occupancyPct: pct,
      fullLotNames: lots.filter((l) => l.capacity > 0 && l.occupied / l.capacity >= PARKING_FULL_RATIO).map((l) => l.name),
      soldOutSlotCount: slots.filter((s) => s.capacity > 0 && s.bookedCount >= s.capacity).length,
      alertDeviceNames: devices.filter((d) => d.status === "ALERT" || d.status === "OFFLINE").map((d) => d.name),
    });
    return { ...result, generatedAt: new Date().toISOString() };
  },
};

// 启用软门时数据受门控,标 private 防中间缓存/CDN 跨用户复用;否则可公开缓存。
// 命中/未命中两条路径必须带同一头,否则 hit 响应丢头会被代理按默认(public)缓存。
function cacheControl(): string {
  return process.env.SCREEN_TOKEN ? "private, max-age=15" : "public, max-age=15";
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ metric: string }> },
) {
  if (!screenGatePassed(req.nextUrl.searchParams.get("k"), req.cookies.get("screen_token")?.value)) {
    return NextResponse.json({ error: "缺少有效访问凭据" }, { status: 401 });
  }

  const { metric } = await ctx.params;
  const resolver = RESOLVERS[metric];
  if (!resolver) {
    return NextResponse.json({ error: "未知指标" }, { status: 404 });
  }

  // 内存 TTL 缓存:轮询天然限频之上再防抓取压垮(自托管常驻进程有效)
  const hit = cache.get(metric);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) {
    return NextResponse.json(hit.data, {
      headers: { "cache-control": cacheControl(), "x-screen-cache": "hit" },
    });
  }

  try {
    const data = await resolver();
    cache.set(metric, { at: now, data });
    return NextResponse.json(data, {
      headers: { "cache-control": cacheControl(), "x-screen-cache": "miss" },
    });
  } catch {
    return NextResponse.json({ error: "取数失败" }, { status: 500 });
  }
}

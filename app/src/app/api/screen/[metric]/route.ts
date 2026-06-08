import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { bookingRepository } from "@/modules/booking";
import { iotRepository } from "@/modules/iot";
import { trafficRepository } from "@/modules/traffic";
import { configService } from "@/modules/system";
import { resolveInstantCapacity, CIRCUIT_BREAK_RATIO } from "@/shared/lib/capacity";
import { chinaTodayDbDate } from "@/shared/lib/time";
import { screenGatePassed } from "@/shared/auth/screen-gate";

// 大屏公开只读轮询端点。/api/* 不过 middleware → 软门在此自校验。
// PII 白名单铁律:只出聚合 / 计数 / 状态枚举,绝不返回 Booking/黑名单/申诉 原始行。
export const dynamic = "force-dynamic";

const TTL_MS = 15_000;
const cache = new Map<string, { at: number; data: unknown }>();

// ── 指标白名单:每个 metric → PII-free 聚合 resolver ──────────────────────────
const RESOLVERS: Record<string, () => Promise<unknown>> = {
  // 在园 / 承载 / 熔断(90% 闪红的数据源)
  occupancy: async () => {
    const today = chinaTodayDbDate();
    const [slots, capacity] = await Promise.all([
      bookingRepository.listSlotsByDate(today).catch(() => []),
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
    const slots = await bookingRepository.listSlotsByDate(chinaTodayDbDate()).catch(() => []);
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

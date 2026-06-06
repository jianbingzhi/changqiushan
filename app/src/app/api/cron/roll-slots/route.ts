import type { NextRequest } from "next/server";
import { slotRollService } from "@/modules/booking";
import { configService } from "@/modules/system";

// BE-A3 每日滚动生成时段。自托管由 pg-boss(instrumentation)按 18:00 跑;
// Vercel serverless 无常驻 worker,改由 Vercel Cron(vercel.json)调用本路由。
// 鉴权:Vercel Cron 自动带 `Authorization: Bearer <CRON_SECRET>`(设了 CRON_SECRET env 时)。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const horizon = await configService.getInt("slot.horizon_days", 14);
  const res = await slotRollService.rollGenerateSlots(horizon);
  if (!res.ok) {
    return Response.json({ ok: false, message: res.message }, { status: 500 });
  }
  return Response.json({ ok: true, ...res.value });
}

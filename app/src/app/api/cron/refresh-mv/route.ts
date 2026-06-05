import type { NextRequest } from "next/server";
import { db } from "@/infrastructure/db/client";

// 物化视图定时刷新。自托管由 pg-boss 每 15 分钟跑;Vercel serverless 无常驻 worker,
// 改由 Vercel Cron(vercel.json)按 schedule 调用本路由。
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

  await db.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_daily_traffic`.catch(() => {});
  await db.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_visitor_source`.catch(() => {});
  await db.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_hourly_peak`.catch(() => {});

  return Response.json({ ok: true });
}

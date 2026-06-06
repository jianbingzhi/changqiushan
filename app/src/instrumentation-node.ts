// 仅 Node.js 运行时执行的启动逻辑。由 instrumentation.ts 在 NEXT_RUNTIME==='nodejs'
// 分支内 await import 进来——这样 webpack 不会把 pg/pg-boss(依赖 fs/path)打进 edge 包,
// 否则 instrumentation 的 edge 编译会因 "Can't resolve 'fs'/'path'" 报错使全站 500。
export async function registerNode() {
  // Vercel/serverless 无常驻进程:pg-listen 的 LISTEN 长连接与 pg-boss worker 都无法可靠存活,
  // 且会在每次冷启动开无用连接/报错。Vercel 上实时改前端门控关闭、定时改 Vercel Cron
  // (/api/cron/refresh-mv)、熔断改核销写路径内联(checkin service)。故此处整体跳过。
  if (process.env.VERCEL) {
    console.log(
      "[instrumentation] Vercel 环境,跳过 pg-listen + pg-boss(实时/定时改 Cron+门控,熔断已内联)",
    );
    return;
  }

  const { startPgListener } = await import(
    "@/infrastructure/realtime/listener"
  );
  const { createBoss, setBoss } = await import("@/infrastructure/jobs/boss");

  // pg-listen: Postgres NOTIFY → in-process bus → SSE
  await startPgListener().catch((err: unknown) => {
    console.error("[instrumentation] pg-listen failed to start", err);
  });

  // pg-boss: scheduled jobs (analytics MV refresh, noshow scan, etc.)
  const boss = createBoss();
  boss.on("error", (err: unknown) => {
    console.error("[instrumentation] pg-boss error", err);
  });
  await boss.start().catch((err: unknown) => {
    console.error("[instrumentation] pg-boss failed to start", err);
  });
  setBoss(boss);

  // pg-boss: 物化视图定时刷新(每 15 分钟)
  // pg-boss v10+ 必须先 createQueue 再 schedule/work,否则反复抛 "Queue ... does not exist"
  await boss.createQueue("refresh-analytics-mv").catch(() => {});
  await boss.schedule("refresh-analytics-mv", "*/15 * * * *", {}).catch(() => {});
  await boss.work("refresh-analytics-mv", async () => {
    const { db } = await import("@/infrastructure/db/client");
    await db.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_daily_traffic`.catch(() => {});
    await db.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_visitor_source`.catch(() => {});
    await db.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_hourly_peak`.catch(() => {});
  }).catch((e: unknown) => {
    console.error("[instrumentation] pg-boss analytics refresh register failed", e);
  });

  // BE-A3 每日滚动生成时段(每天 18:00)。薄壳:读 horizon 配置 → 调 rollGenerateSlots
  // (与 Vercel Cron /api/cron/roll-slots 共用一份逻辑,两入口)。
  await boss.createQueue("roll-slots").catch(() => {});
  await boss.schedule("roll-slots", "0 18 * * *", {}).catch(() => {});
  await boss.work("roll-slots", async () => {
    const { slotRollService } = await import("@/modules/booking");
    const { configService } = await import("@/modules/system");
    const horizon = await configService.getInt("slot.horizon_days", 14);
    const res = await slotRollService.rollGenerateSlots(horizon);
    if (!res.ok) console.error("[instrumentation] roll-slots failed", res.message);
  }).catch((e: unknown) => {
    console.error("[instrumentation] pg-boss roll-slots register failed", e);
  });

  // 熔断(红线4)已移到核销写路径内联(checkin service 的 pauseSlotsForCircuitBreak),
  // 自托管与 serverless 都成立,故此处不再挂 bus 监听(避免双触发)。
}

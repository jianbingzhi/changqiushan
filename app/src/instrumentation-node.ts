// 仅 Node.js 运行时执行的启动逻辑。由 instrumentation.ts 在 NEXT_RUNTIME==='nodejs'
// 分支内 await import 进来——这样 webpack 不会把 pg/pg-boss(依赖 fs/path)打进 edge 包,
// 否则 instrumentation 的 edge 编译会因 "Can't resolve 'fs'/'path'" 报错使全站 500。
export async function registerNode() {
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
  await boss.schedule("refresh-analytics-mv", "*/15 * * * *", {}).catch(() => {});
  await boss.work("refresh-analytics-mv", async () => {
    const { db } = await import("@/infrastructure/db/client");
    await db.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_daily_traffic`.catch(() => {});
    await db.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_visitor_source`.catch(() => {});
    await db.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_hourly_peak`.catch(() => {});
  }).catch((e: unknown) => {
    console.error("[instrumentation] pg-boss analytics refresh register failed", e);
  });

  // 熔断事件监听: checkin_event → 在园达 90% 时自动暂停当日时段
  const { bus } = await import("@/infrastructure/realtime/bus");
  const { bookingService } = await import("@/modules/booking");
  const { db } = await import("@/infrastructure/db/client");
  bus.on("checkin_event", async (payload: { slotId: string; circuitBroken: boolean }) => {
    if (!payload.circuitBroken) return;
    const slot = await db.bookingSlot.findUnique({
      where: { id: payload.slotId }, select: { date: true },
    }).catch(() => null);
    if (slot) {
      await bookingService.pauseSlotsForCircuitBreak(slot.date).catch((e: unknown) => {
        console.error("[instrumentation] circuit break pause failed", e);
      });
    }
  });
}

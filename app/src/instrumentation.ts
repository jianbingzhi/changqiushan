export async function register() {
  // Next.js instrumentation hook — runs once in Node.js runtime on server startup.
  // Edge runtime does not run this (guarded by runtime check below).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

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
}

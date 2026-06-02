// Next.js instrumentation 钩子 — 服务启动时运行一次。
// 关键:node-only 的启动逻辑放在单独的 instrumentation-node.ts,并且只在
// NEXT_RUNTIME==='nodejs' 分支内 await import,确保它不会被打进 edge 运行时包
// (pg/pg-boss 依赖 fs/path,进 edge 包会编译失败导致全站 500)。
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}

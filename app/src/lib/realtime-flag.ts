// 实时(SSE)总开关。默认开 —— 本地 docker / 自托管不设此变量即保持实时;
// Vercel serverless 无常驻进程(pg-listen 失效),在 Vercel 环境设
// NEXT_PUBLIC_REALTIME_ENABLED=false 关闭,前端改为 SSR 首屏快照 + 手动刷新。
// 必须用 NEXT_PUBLIC_ 前缀:客户端组件需在构建期内联读取。
export const REALTIME_ENABLED =
  process.env.NEXT_PUBLIC_REALTIME_ENABLED !== "false";

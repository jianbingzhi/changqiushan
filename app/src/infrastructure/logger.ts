import pino from "pino";

export const logger = pino({
  // `||` 而非 `??`:compose 白名单用 `${LOG_LEVEL:-}` 透传,未配置时容器里是空串;
  // 空串走 `??` 会被当成"配了"传给 pino,pino 对未知 level 直接抛错 → 进程起不来(round-01 N21)
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "yyyy-mm-dd HH:MM:ss.l" },
    },
  }),
});

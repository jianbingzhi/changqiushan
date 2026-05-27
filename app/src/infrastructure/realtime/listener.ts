import createSubscriber from "pg-listen";
import { logger } from "@/infrastructure/logger";
import { bus } from "./bus";

// 已订阅的 channel 列表 — 数据库里建好 trigger 之后,把 channel 名加到这里
const CHANNELS = ["slot_changed", "checkin_event", "iot_event", "parking_state"];

const globalForListener = globalThis as unknown as { __pgListener?: ReturnType<typeof createSubscriber> };

export async function startPgListener() {
  if (globalForListener.__pgListener) {
    logger.debug("pg-listen already started");
    return globalForListener.__pgListener;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logger.warn("DATABASE_URL not set; pg-listen 未启动");
    return null;
  }

  const subscriber = createSubscriber({ connectionString });

  subscriber.events.on("error", (err) => {
    logger.error({ err }, "pg-listen error");
  });

  subscriber.events.on("connected", () => {
    logger.info("pg-listen connected");
  });

  for (const channel of CHANNELS) {
    subscriber.notifications.on(channel, (payload) => {
      logger.debug({ channel, payload }, "NOTIFY received");
      bus.publish(channel, payload);
    });
  }

  await subscriber.connect();
  for (const channel of CHANNELS) {
    await subscriber.listenTo(channel);
  }

  globalForListener.__pgListener = subscriber;

  // 优雅退出
  const shutdown = async () => {
    logger.info("shutting down pg-listen");
    await subscriber.close().catch(() => {});
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return subscriber;
}

import type { NextRequest } from "next/server";
import { bus } from "@/infrastructure/realtime/bus";
import { startPgListener } from "@/infrastructure/realtime/listener";
import { logger } from "@/infrastructure/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600; // 10 分钟,Stitch nginx 心跳后会续连

// 已知 topic 白名单(防止任意字符串注入)
const ALLOWED_TOPICS = new Set([
  "slot_changed",
  "checkin_event",
  "iot_event",
  "parking_state",
]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ topic: string }> }) {
  const { topic } = await ctx.params;

  if (!ALLOWED_TOPICS.has(topic)) {
    return new Response(JSON.stringify({ error: "unknown topic" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  await startPgListener();

  const encoder = new TextEncoder();
  let onEvent: ((payload: unknown) => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 立即推一条 hello 让客户端知道连上了
      controller.enqueue(encoder.encode(`event: hello\ndata: {"topic":"${topic}"}\n\n`));

      onEvent = (payload) => {
        try {
          const data = JSON.stringify(payload);
          controller.enqueue(encoder.encode(`event: ${topic}\ndata: ${data}\n\n`));
        } catch (err) {
          logger.warn({ err }, "SSE encode failed");
        }
      };
      bus.on(topic, onEvent);

      // 心跳防止 nginx/代理超时
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
      }, 25_000);
    },
    cancel() {
      if (onEvent) bus.off(topic, onEvent);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no", // 关闭 nginx 缓冲
    },
  });
}

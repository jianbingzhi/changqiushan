import type { NextRequest } from "next/server";
import { bus } from "@/infrastructure/realtime/bus";
import { startPgListener } from "@/infrastructure/realtime/listener";
import { logger } from "@/infrastructure/logger";
import { getSession } from "@/infrastructure/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel Hobby 上限 300s(超了部署被拒);自托管 next start 不强制此值,SSE 仍可长连。
// Vercel 上实时本就关闭(NEXT_PUBLIC_REALTIME_ENABLED=false,前端不连此路由)。
export const maxDuration = 300;

// 已知 topic 白名单(防止任意字符串注入)
const ALLOWED_TOPICS = new Set([
  "slot_changed",
  "checkin_event",
  "iot_event",
  "parking_state",
]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ topic: string }> }) {
  // R2 Vercel 短路:serverless 无常驻 pg-listen,实时本就前端门控关闭。直接 503(语义=本环境
  // 暂不可用,非 500 错误),不挂长连、不耗 maxDuration;前端已 gate 不会连,双保险。
  if (process.env.VERCEL || process.env.NEXT_PUBLIC_REALTIME_ENABLED === "false") {
    return new Response("实时功能在此环境关闭", { status: 503 });
  }

  // 鉴权门:四路实时流(核销/IoT/车位/时段)均为 B 端管理数据,须登录员工态。
  // /api/* 不经 middleware(matcher 负向排除 api/),故各 route handler 自带鉴权。
  // 访客 token 走独立密钥(VISITOR_JWT_SECRET),getSession 用 B 端密钥验签,天然排除游客。
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

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

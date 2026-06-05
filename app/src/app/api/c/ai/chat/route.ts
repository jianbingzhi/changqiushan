import type { NextRequest } from "next/server";
import { aiService } from "@/modules/ai";
import { requireVisitor } from "../../_lib/requireVisitor";
import { badJson } from "../../_lib/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/c/ai/chat { message, conversationId? } → chunked 流式帧
//   帧格式: data:{"conversationId":...}\n\n / data:{"t":"片段"}\n\n / data:{"done":true}\n\n
export async function POST(req: NextRequest) {
  const auth = await requireVisitor(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badJson();
  }

  const encoder = new TextEncoder();
  const frame = (obj: unknown) => encoder.encode(`data:${JSON.stringify(obj)}\n\n`);
  const sseHeaders = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };

  const prepared = await aiService.startChat(auth.session.visitorId, body);
  // 校验失败也走 SSE 错误帧(而非普通 JSON):chunked 客户端只解析 data: 帧,否则用户只见空气泡
  if (!prepared.ok) {
    const errStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(frame({ error: prepared.message }));
        controller.enqueue(frame({ done: true }));
        controller.close();
      },
    });
    return new Response(errStream, { headers: sseHeaders });
  }

  const { conversationId, messages } = prepared.value;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(frame({ conversationId }));
      let full = "";
      try {
        for await (const token of aiService.streamReply(messages)) {
          full += token;
          controller.enqueue(frame({ t: token }));
        }
      } catch {
        controller.enqueue(frame({ t: "（回答中断，请重试）" }));
      }
      await aiService.finalizeReply(conversationId, full);
      controller.enqueue(frame({ done: true }));
      controller.close();
    },
  });

  return new Response(stream, { headers: sseHeaders });
}

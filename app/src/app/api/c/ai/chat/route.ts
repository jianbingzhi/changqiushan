import type { NextRequest } from "next/server";
import { aiService } from "@/modules/ai";
import { requireVisitor } from "../../_lib/requireVisitor";
import { jsonErr, badJson } from "../../_lib/respond";

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

  const prepared = await aiService.startChat(auth.session.visitorId, body);
  if (!prepared.ok) return jsonErr(prepared.code, prepared.message);

  const { conversationId, messages } = prepared.value;
  const encoder = new TextEncoder();
  const frame = (obj: unknown) => encoder.encode(`data:${JSON.stringify(obj)}\n\n`);

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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

// 大模型流式 client(OpenAI 兼容 /chat/completions, stream:true)
// 直连,无检索召回(非 RAG);key 仅服务端读取,绝不下发
// 放 infrastructure(module-internal 可依赖;lib 不可被 module 依赖)
import { getAiCredentials } from "@/infrastructure/config/integration";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 上游 token 流逐字 yield;未配置/失败时 yield 一段降级文案,调用方无需另写兜底 */
export async function* aiStreamCompletion(messages: ChatMessage[]): AsyncGenerator<string> {
  const { baseURL, model, apiKey } = getAiCredentials();
  if (!baseURL || !apiKey) {
    yield "AI 助手暂未配置，您可前往「首页 - 预约入园」直接预约，或拨打景区服务电话咨询。";
    return;
  }

  let res: Response;
  try {
    res = await fetch(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, stream: true, messages }),
    });
  } catch {
    yield "AI 服务暂时不可用，请稍后重试。";
    return;
  }
  if (!res.ok || !res.body) {
    yield "AI 服务暂时不可用，请稍后重试。";
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const token = json?.choices?.[0]?.delta?.content;
        if (typeof token === "string" && token) yield token;
      } catch {
        // 跳过非 JSON 帧(心跳等)
      }
    }
  }
}

import { aiRepository } from "../repository";
import { chatSchema } from "../domain/schema";
import { SCENIC_SYSTEM_PROMPT } from "../domain/prompt";
import { aiStreamCompletion, type ChatMessage } from "@/infrastructure/ai/client";
import { ok, err, ErrCode, type Result } from "@/shared/result";
import type { AiConversation, AiMessage } from "@prisma/client";

// 多轮上下文截断:保留最近 N 轮(控制 token 成本)
const HISTORY_LIMIT = 12;

export interface PreparedChat {
  conversationId: string;
  messages: ChatMessage[];
}

export const aiService = {
  // 落用户消息(必要时建会话),返回拼好 system + 截断历史 的待发消息序列
  async startChat(
    visitorId: string,
    raw: unknown,
  ): Promise<Result<PreparedChat>> {
    const parsed = chatSchema.safeParse(raw);
    if (!parsed.success) return err(ErrCode.INVALID_INPUT, parsed.error.issues[0].message);
    const { message, conversationId } = parsed.data;

    let convId = conversationId;
    if (convId) {
      const conv = await aiRepository.getConversation(convId);
      if (!conv || conv.visitorId !== visitorId) {
        return err(ErrCode.PERMISSION_DENIED, "无权访问该会话");
      }
    } else {
      const title = message.slice(0, 20);
      const conv = await aiRepository.createConversation(visitorId, title);
      convId = conv.id;
    }

    await aiRepository.appendMessage(convId, "USER", message);

    const history = await aiRepository.getMessages(convId);
    const recent = history.slice(-HISTORY_LIMIT);
    const messages: ChatMessage[] = [
      { role: "system", content: SCENIC_SYSTEM_PROMPT },
      ...recent.map((m): ChatMessage => ({
        role: m.role === "USER" ? "user" : "assistant",
        content: m.content,
      })),
    ];
    return ok({ conversationId: convId, messages });
  },

  // 上游 token 流(直连大模型,降级文案在 client 内处理)
  streamReply(messages: ChatMessage[]): AsyncGenerator<string> {
    return aiStreamCompletion(messages);
  },

  async finalizeReply(conversationId: string, content: string): Promise<void> {
    if (!content) return;
    await aiRepository.appendMessage(conversationId, "ASSISTANT", content);
    await aiRepository.touchConversation(conversationId);
  },

  listConversations(visitorId: string): Promise<AiConversation[]> {
    return aiRepository.listConversations(visitorId);
  },

  async getMessages(conversationId: string, visitorId: string): Promise<Result<AiMessage[]>> {
    const conv = await aiRepository.getConversation(conversationId);
    if (!conv || conv.visitorId !== visitorId) return err(ErrCode.PERMISSION_DENIED, "无权访问该会话");
    const messages = await aiRepository.getMessages(conversationId);
    return ok(messages);
  },
};

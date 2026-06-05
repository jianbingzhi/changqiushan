import { db } from "@/infrastructure/db/client";
import type { AiConversation, AiMessage, AiRole } from "@prisma/client";

export const aiRepository = {
  createConversation(visitorId: string, title: string): Promise<AiConversation> {
    return db.aiConversation.create({ data: { visitorId, title } });
  },

  getConversation(id: string): Promise<AiConversation | null> {
    return db.aiConversation.findUnique({ where: { id } });
  },

  listConversations(visitorId: string): Promise<AiConversation[]> {
    return db.aiConversation.findMany({
      where: { visitorId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
  },

  appendMessage(conversationId: string, role: AiRole, content: string): Promise<AiMessage> {
    return db.aiMessage.create({ data: { conversationId, role, content } });
  },

  getMessages(conversationId: string): Promise<AiMessage[]> {
    return db.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
  },

  touchConversation(id: string): Promise<AiConversation> {
    return db.aiConversation.update({ where: { id }, data: { updatedAt: new Date() } });
  },
};

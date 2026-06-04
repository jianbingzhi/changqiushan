import { z } from "zod";

export const chatSchema = z.object({
  message: z.string().min(1, "请输入问题").max(1000, "问题过长"),
  conversationId: z.string().uuid().optional(),
});

export type ChatInput = z.infer<typeof chatSchema>;

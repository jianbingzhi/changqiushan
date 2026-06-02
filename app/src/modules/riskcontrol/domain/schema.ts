import { z } from "zod";

export const submitAppealSchema = z.object({
  blacklistId: z.string().uuid("blacklistId 必须是 UUID"),
  userId:      z.string().uuid("userId 必须是 UUID"),
  reason:      z.string().min(10, "申诉原因至少 10 字").max(500, "申诉原因不超过 500 字"),
});

export const reviewAppealSchema = z.object({
  appealId:   z.string().uuid(),
  status:     z.enum(["APPROVED", "REJECTED"]),
  reviewedBy: z.string().uuid(),
  reviewNote: z.string().max(500).optional(),
});

export type SubmitAppealInput = z.infer<typeof submitAppealSchema>;
export type ReviewAppealInput = z.infer<typeof reviewAppealSchema>;

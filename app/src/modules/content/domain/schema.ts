import { z } from "zod";

export const createIntroSchema = z.object({
  title:      z.string().min(1, "标题不能为空").max(80),
  body:       z.string().min(1, "正文不能为空"),
  coverImage: z.string().max(255).optional(),
  sortOrder:  z.coerce.number().int().min(0).default(0),
});
export const updateIntroSchema = createIntroSchema.partial();

const activityBaseSchema = z.object({
  title:           z.string().min(1, "标题不能为空").max(80),
  description:     z.string().optional(),
  coverImage:      z.string().max(255).optional(),
  startDate:       z.coerce.date(),
  endDate:         z.coerce.date(),
  maxParticipants: z.coerce.number().int().positive().optional(),
  registrationFee: z.coerce.number().min(0).default(0),
});
export const createActivitySchema = activityBaseSchema.refine(
  (v) => v.endDate >= v.startDate,
  { message: "结束日期不能早于开始日期", path: ["endDate"] },
);
export const updateActivitySchema = activityBaseSchema.partial();

export const createKnowledgeSchema = z.object({
  title:     z.string().min(1, "标题不能为空").max(80),
  content:   z.string().min(1, "内容不能为空"),
  category:  z.string().max(40).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});
export const updateKnowledgeSchema = createKnowledgeSchema.partial();

export const createNewsSchema = z.object({
  title:      z.string().min(1, "标题不能为空").max(80),
  summary:    z.string().optional(),
  body:       z.string().min(1, "正文不能为空"),
  coverImage: z.string().max(255).optional(),
});
export const updateNewsSchema = createNewsSchema.partial();

// C 端活动报名:复用与预约同口径的身份证/手机校验(红线#2)
export const createSignupSchema = z.object({
  userName: z.string().min(1, "姓名不能为空").max(40),
  idCard:   z.string().length(18, "身份证号必须 18 位"),
  phone:    z.string().regex(/^1[3-9]\d{9}$/, "手机号格式无效"),
});

export const reviewSignupSchema = z.object({
  signupId: z.string().uuid("signupId 必须是 UUID"),
  status:   z.enum(["APPROVED", "REJECTED"]),
  note:     z.string().max(500).optional(),
});

export type CreateIntroInput     = z.infer<typeof createIntroSchema>;
export type UpdateIntroInput     = z.infer<typeof updateIntroSchema>;
export type CreateActivityInput  = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput  = z.infer<typeof updateActivitySchema>;
export type CreateKnowledgeInput = z.infer<typeof createKnowledgeSchema>;
export type UpdateKnowledgeInput = z.infer<typeof updateKnowledgeSchema>;
export type CreateNewsInput      = z.infer<typeof createNewsSchema>;
export type UpdateNewsInput      = z.infer<typeof updateNewsSchema>;
export type CreateSignupInput    = z.infer<typeof createSignupSchema>;
export type ReviewSignupInput    = z.infer<typeof reviewSignupSchema>;

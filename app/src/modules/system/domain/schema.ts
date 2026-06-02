import { z } from "zod";

export const createAdminSchema = z.object({
  phone:    z.string().regex(/^1[3-9]\d{9}$/, "手机号格式无效"),
  password: z.string().min(8, "密码至少 8 位"),
  name:     z.string().min(1).max(40),
  workerId: z.string().max(32).optional(),
  roleCode: z.string().min(1),
});

export const writeAuditSchema = z.object({
  actorId:  z.string().uuid("actorId 必须是 UUID"),
  action:   z.string().min(1).max(60),
  resource: z.string().min(1).max(40),
  detail:   z.record(z.string(), z.unknown()).optional(),
  ip:       z.string().max(45).optional(),
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type WriteAuditInput  = z.infer<typeof writeAuditSchema>;

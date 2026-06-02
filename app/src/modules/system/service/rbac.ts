import { ok, err, type Result, ErrCode } from "@/shared/result";
import { writeAuditSchema, type WriteAuditInput } from "../domain/schema";
import { systemRepository } from "../repository";

export const rbacService = {
  async checkPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const profile = await systemRepository.findProfile(userId);
    if (!profile || profile.status !== "ACTIVE") return false;

    for (const rp of profile.roles) {
      const perms = await systemRepository.findPermissions(rp.role.code);
      if (perms.some((p: { permission: { resource: string; action: string } }) => p.permission.resource === resource && p.permission.action === action)) {
        return true;
      }
    }
    return false;
  },

  async writeAudit(data: WriteAuditInput): Promise<Result<void>> {
    const parsed = writeAuditSchema.safeParse(data);
    if (!parsed.success) {
      return err(ErrCode.INVALID_INPUT, parsed.error.issues[0].message);
    }
    await systemRepository.writeAudit(parsed.data);
    return ok(undefined);
  },
};

import {
  createAuthUser,
  deleteAuthUser,
  updateAuthUserPassword,
} from "@/infrastructure/auth/gotrue-admin";
import { ok, err, type Result, ErrCode } from "@/shared/result";
import { createAdminSchema, type CreateAdminInput } from "../domain/schema";
import { validateRoleCode } from "../domain/rules";
import { systemRepository } from "../repository";

export const adminService = {
  async createAdmin(input: CreateAdminInput): Promise<Result<{ id: string }>> {
    const parsed = createAdminSchema.safeParse(input);
    if (!parsed.success) {
      return err(ErrCode.INVALID_INPUT, parsed.error.issues[0].message);
    }

    const { phone, password, name, workerId, roleCode } = parsed.data;

    if (!validateRoleCode(roleCode)) {
      return err(ErrCode.INVALID_INPUT, `无效角色代码: ${roleCode}`);
    }

    const role = await systemRepository.findRole(roleCode);
    if (!role) {
      return err(ErrCode.NOT_FOUND, `角色 ${roleCode} 不存在`);
    }

    // 两步事务: GoTrue → public DB; DB 失败时回调 GoTrue 删用户(saga 补偿)
    // E2: roleCode 透传给 GoTrue 写入 app_metadata,角色随 JWT 走
    const authUser = await createAuthUser(phone, password, roleCode);

    try {
      await systemRepository.createProfile({ id: authUser.id, name, workerId, roleId: role.id });
      return ok({ id: authUser.id });
    } catch (dbError) {
      await deleteAuthUser(authUser.id).catch(() => {
        console.error(`[system] GoTrue 回滚失败,孤儿用户: ${authUser.id}`);
      });
      throw dbError;
    }
  },

  async resetPassword(userId: string, newPassword: string): Promise<Result<void>> {
    if (newPassword.length < 8) {
      return err(ErrCode.INVALID_INPUT, "密码至少 8 位");
    }
    await updateAuthUserPassword(userId, newPassword);
    return ok(undefined);
  },

  async disableAdmin(actorId: string, targetId: string): Promise<Result<void>> {
    const profile = await systemRepository.findProfile(targetId);
    if (!profile) {
      return err(ErrCode.NOT_FOUND, "管理员不存在");
    }
    await systemRepository.updateProfile(targetId, { status: "DISABLED" });
    await systemRepository.writeAudit({
      actorId,
      action: "DISABLE_ADMIN",
      resource: "sys_profile",
      detail: { targetId },
    });
    return ok(undefined);
  },
};

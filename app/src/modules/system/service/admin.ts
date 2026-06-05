import {
  createAuthUser,
  deleteAuthUser,
  updateAuthUserPassword,
  banAuthUser,
} from "@/infrastructure/auth/gotrue-admin";
import { ok, err, type Result, ErrCode } from "@/shared/result";
import { createAdminSchema, type CreateAdminInput } from "../domain/schema";
import { validateRoleCode, roleWeight } from "../domain/rules";
import { systemRepository } from "../repository";

/** 取某账号当前角色代码(取首个角色);用于纵深层级校验 */
async function resolveRoleCode(profileId: string): Promise<string | null> {
  const profile = await systemRepository.findProfile(profileId);
  return profile?.roles?.[0]?.role?.code ?? null;
}

export const adminService = {
  async createAdmin(
    actorId: string,
    input: CreateAdminInput,
  ): Promise<Result<{ id: string }>> {
    const parsed = createAdminSchema.safeParse(input);
    if (!parsed.success) {
      return err(ErrCode.INVALID_INPUT, parsed.error.issues[0].message);
    }

    const { phone, password, name, workerId, roleCode } = parsed.data;

    if (!validateRoleCode(roleCode)) {
      return err(ErrCode.INVALID_INPUT, `无效角色代码: ${roleCode}`);
    }

    // 纵深防御:不得创建权限高于自身的账号(actor 解析失败则跳过,action 层 SUPER_ONLY 已是堵点)
    const actorRole = await resolveRoleCode(actorId);
    if (actorRole && roleWeight(roleCode) > roleWeight(actorRole)) {
      return err(ErrCode.PERMISSION_DENIED, "不能创建权限高于自身的账号");
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
      await systemRepository.writeAudit({
        actorId,
        action: "CREATE_ADMIN",
        resource: "sys_profile",
        detail: { targetId: authUser.id, roleCode },
      });
      return ok({ id: authUser.id });
    } catch (dbError) {
      await deleteAuthUser(authUser.id).catch(() => {
        console.error(`[system] GoTrue 回滚失败,孤儿用户: ${authUser.id}`);
      });
      throw dbError;
    }
  },

  async resetPassword(
    actorId: string,
    userId: string,
    newPassword: string,
  ): Promise<Result<void>> {
    if (newPassword.length < 8) {
      return err(ErrCode.INVALID_INPUT, "密码至少 8 位");
    }

    // 纵深防御:不得重置权限高于自身的账号(重置自身/同级/下级允许)
    if (userId !== actorId) {
      const actorRole = await resolveRoleCode(actorId);
      const targetRole = await resolveRoleCode(userId);
      if (actorRole && roleWeight(targetRole) > roleWeight(actorRole)) {
        return err(ErrCode.PERMISSION_DENIED, "不能重置权限高于自身的账号密码");
      }
    }

    await updateAuthUserPassword(userId, newPassword);
    await systemRepository.writeAudit({
      actorId,
      action: "RESET_PASSWORD",
      resource: "sys_profile",
      detail: { targetId: userId },
    });
    return ok(undefined);
  },

  async disableAdmin(actorId: string, targetId: string): Promise<Result<void>> {
    // 纵深防御:禁止自我停用(避免唯一管理员把自己锁死)
    if (actorId === targetId) {
      return err(ErrCode.PERMISSION_DENIED, "不能停用自己的账号");
    }

    const profile = await systemRepository.findProfile(targetId);
    if (!profile) {
      return err(ErrCode.NOT_FOUND, "管理员不存在");
    }

    // 纵深防御:不得停用权限高于自身的账号
    const actorRole = await resolveRoleCode(actorId);
    const targetRole = profile.roles?.[0]?.role?.code ?? null;
    if (actorRole && roleWeight(targetRole) > roleWeight(actorRole)) {
      return err(ErrCode.PERMISSION_DENIED, "不能停用权限高于自身的账号");
    }

    await systemRepository.updateProfile(targetId, { status: "DISABLED" });
    // 封禁 GoTrue 用户,撤销其在用/可刷新 JWT(否则停用仅改 profile 状态,令牌仍有效)
    await banAuthUser(targetId).catch((e: unknown) => {
      console.error(`[system] 停用后封禁 GoTrue 失败: ${targetId}`, e);
    });
    await systemRepository.writeAudit({
      actorId,
      action: "DISABLE_ADMIN",
      resource: "sys_profile",
      detail: { targetId },
    });
    return ok(undefined);
  },
};

import { db } from "@/infrastructure/db/client";
import type { Prisma } from "@prisma/client";

export const systemRepository = {
  findProfile(id: string) {
    return db.sysProfile.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
  },

  findAllProfiles() {
    return db.sysProfile.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  createProfile(data: { id: string; name: string; workerId?: string; roleId: string }) {
    return db.sysProfile.create({
      data: {
        id: data.id,
        name: data.name,
        workerId: data.workerId,
        roles: { create: { roleId: data.roleId } },
      },
    });
  },

  updateProfile(id: string, data: Prisma.SysProfileUpdateInput) {
    return db.sysProfile.update({ where: { id }, data });
  },

  deleteProfile(id: string) {
    return db.sysProfile.delete({ where: { id } });
  },

  findRole(code: string) {
    return db.sysRole.findUnique({ where: { code } });
  },

  findPermissions(roleCode: string) {
    return db.sysRolePermission.findMany({
      where: { role: { code: roleCode } },
      include: { permission: true },
    });
  },

  writeAudit(data: {
    actorId: string;
    action: string;
    resource: string;
    detail?: Record<string, unknown>;
    ip?: string;
  }) {
    return db.sysAuditLog.create({
      data: {
        ...data,
        detail: data.detail as Prisma.InputJsonValue | undefined,
      },
    });
  },
};

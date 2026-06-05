import type { SysProfile } from "@prisma/client";

export const KNOWN_ROLE_CODES = ["SUPER_ADMIN", "ADMIN", "OPERATOR"] as const;
export type RoleCode = (typeof KNOWN_ROLE_CODES)[number];

export function validateRoleCode(code: string): code is RoleCode {
  return (KNOWN_ROLE_CODES as readonly string[]).includes(code);
}

// 角色权重(纵深防御层级校验用):数值越大权限越高。未知角色 → 0。
const ROLE_WEIGHT: Record<RoleCode, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  OPERATOR: 1,
};

export function roleWeight(code: string | null | undefined): number {
  return code && validateRoleCode(code) ? ROLE_WEIGHT[code] : 0;
}

export function isAccountActive(profile: Pick<SysProfile, "status">): boolean {
  return profile.status === "ACTIVE";
}

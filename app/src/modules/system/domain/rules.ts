import type { SysProfile } from "@prisma/client";

export const KNOWN_ROLE_CODES = ["SUPER_ADMIN", "ADMIN", "OPERATOR"] as const;
export type RoleCode = (typeof KNOWN_ROLE_CODES)[number];

export function validateRoleCode(code: string): code is RoleCode {
  return (KNOWN_ROLE_CODES as readonly string[]).includes(code);
}

export function isAccountActive(profile: Pick<SysProfile, "status">): boolean {
  return profile.status === "ACTIVE";
}

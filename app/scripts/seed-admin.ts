/**
 * 引导真实登录管理员(GoTrue 用户 + sys_profile)。
 *   pnpm exec tsx scripts/seed-admin.ts
 * 依赖 db:seed 已建好 sys_role。幂等:先删同手机号的 GoTrue 用户再重建。
 * 默认账号:手机号 13900000000 / 密码 Admin@12345 / 角色 SUPER_ADMIN
 */
import "dotenv/config";
import { SignJWT } from "jose";
import { adminService } from "@/modules/system";

const GOTRUE_URL = process.env.GOTRUE_URL ?? "http://localhost:9999";
const SECRET = new TextEncoder().encode(process.env.GOTRUE_JWT_SECRET ?? "");
const PHONE = "13900000000";
const PASSWORD = "Admin@12345";

async function main() {
  const svc = await new SignJWT({ role: "service_role" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(SECRET);
  const h = { "Content-Type": "application/json", Authorization: `Bearer ${svc}`, apikey: svc };

  // 幂等:删除同手机号旧用户(同时清掉其 sys_profile,避免孤儿)
  const list = await fetch(`${GOTRUE_URL}/admin/users`, { headers: h }).then((r) => r.json()).catch(() => ({}));
  for (const u of (list.users ?? [])) {
    if (u.phone === PHONE) {
      await fetch(`${GOTRUE_URL}/admin/users/${u.id}`, { method: "DELETE", headers: h }).catch(() => {});
      const { db } = await import("@/infrastructure/db/client");
      await db.sysProfile.deleteMany({ where: { id: u.id } }).catch(() => {});
    }
  }

  // 引导期无登录 actor,用 nil UUID 作系统操作人(审计无 FK,层级校验对未知 actor 跳过)
  const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000000";
  const r = await adminService.createAdmin(SYSTEM_ACTOR, {
    phone: PHONE,
    password: PASSWORD,
    name: "系统超管",
    workerId: "ROOT-001",
    roleCode: "SUPER_ADMIN",
  });
  if (!r.ok) {
    console.error("引导管理员失败:", r.message);
    process.exit(1);
  }
  console.log(`引导管理员完成: 手机号 ${PHONE} / 密码 ${PASSWORD} / 角色 SUPER_ADMIN / id ${r.value.id}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

import { SignJWT } from "jose";

const GOTRUE_URL = process.env.GOTRUE_URL ?? "http://localhost:9999";
const JWT_SECRET = process.env.GOTRUE_JWT_SECRET ?? "";

async function makeServiceToken(): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({ role: "service_role" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

async function gotrueAdminFetch(path: string, init?: RequestInit) {
  const token = await makeServiceToken();
  const res = await fetch(`${GOTRUE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: token,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GoTrue admin ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

export interface GoTrueUser {
  id: string;
  phone: string;
  email?: string;
  app_metadata: Record<string, unknown>;
  created_at: string;
}

// E2: 业务角色写入 GoTrue app_metadata,随签发的 JWT 一并下发(D3 架构)。
// app_metadata 仅服务端可改,客户端不可篡改,适合承载角色。
export async function createAuthUser(
  phone: string,
  password: string,
  roleCode: string,
): Promise<GoTrueUser> {
  return gotrueAdminFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      phone,
      password,
      phone_confirm: true,
      app_metadata: { role: roleCode },
    }),
  });
}

export async function deleteAuthUser(userId: string): Promise<void> {
  await gotrueAdminFetch(`/admin/users/${userId}`, { method: "DELETE" });
}

// 停用账号时封禁 GoTrue 用户,使其已签发/可刷新的 JWT 失效(否则被停用者仍能操作)。
// ban_duration 设为超长时段≈永久;恢复时传 "none"。
export async function banAuthUser(userId: string, ban = true): Promise<void> {
  await gotrueAdminFetch(`/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ ban_duration: ban ? "876000h" : "none" }),
  });
}

export async function updateAuthUserPassword(userId: string, password: string): Promise<void> {
  await gotrueAdminFetch(`/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
}

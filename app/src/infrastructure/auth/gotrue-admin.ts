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

export async function createAuthUser(phone: string, password: string): Promise<GoTrueUser> {
  return gotrueAdminFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({ phone, password, phone_confirm: true }),
  });
}

export async function deleteAuthUser(userId: string): Promise<void> {
  await gotrueAdminFetch(`/admin/users/${userId}`, { method: "DELETE" });
}

export async function updateAuthUserPassword(userId: string, password: string): Promise<void> {
  await gotrueAdminFetch(`/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
}

import { jwtVerify } from "jose";
import { cookies } from "next/headers";

export interface Session {
  userId: string;
  role: string;
  phone?: string;
}

const JWT_SECRET = process.env.GOTRUE_JWT_SECRET ?? "";

export async function getSession(): Promise<Session | null> {
  try {
    const store = await cookies();
    const token =
      store.get("sb-access-token")?.value ?? store.get("access_token")?.value;
    if (!token) return null;

    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    const sub = payload.sub;
    const role = (payload.role as string | undefined) ?? "authenticated";
    const phone = payload.phone as string | undefined;

    if (!sub) return null;
    return { userId: sub, role, phone };
  } catch {
    return null;
  }
}

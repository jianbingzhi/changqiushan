import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "./_login-form";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from "@/shared/auth/refresh";

export const metadata = {
  title: "登录 · 长秋山森林公园智慧景区管理后台",
};

async function loginAction(formData: FormData): Promise<string | never> {
  "use server";

  const account  = (formData.get("account") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!account || !password) return "请填写手机号/邮箱和密码";

  // 账号含 @ 视为邮箱,走邮箱密码登录;否则按手机号登录。
  // 邮箱登录无需短信验证,运维更省事(GoTrue 手机验证码链路繁琐)。
  const isEmail = account.includes("@");
  const credential = isEmail ? { email: account } : { phone: account };

  const GOTRUE_URL = process.env.GOTRUE_URL ?? "http://localhost:9999";

  // Supabase 云 Auth 网关要求带 apikey(anon key)头;自托管 GoTrue 会忽略该头,故可统一发。
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.SUPABASE_ANON_KEY) headers["apikey"] = process.env.SUPABASE_ANON_KEY;

  let data: { access_token?: string; refresh_token?: string };
  try {
    const res = await fetch(`${GOTRUE_URL}/token?grant_type=password`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...credential, password }),
      cache: "no-store",
    });
    data = await res.json();
    if (!res.ok || !data.access_token) return "账号或密码错误";
  } catch {
    return "服务暂时不可用，请稍后重试";
  }

  // B16 会话滑动续期:除 access 外额外存 refresh_token,middleware 临近过期主动续期的前提。
  // cookie 寿命/secure 口径与 middleware 收口在 shared/auth/refresh,避免双源漂移。
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, data.access_token, accessCookieOptions());
  if (data.refresh_token) {
    cookieStore.set(REFRESH_COOKIE, data.refresh_token, refreshCookieOptions());
  }

  redirect("/");
}

export default function LoginPage() {
  return (
    <div className="w-[400px] bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-8">
      <div className="mb-8 text-center">
        <div
          className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: "#2D5A27" }}
        >
          <svg width="28" height="22" viewBox="0 0 28 22" fill="none" aria-hidden="true">
            <path d="M2 20L8 8L14 15L19 7L26 20H2Z" fill="white" fillOpacity="0.92" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#1F2937]">长秋山森林公园智慧景区</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">管理后台</p>
      </div>
      <LoginForm action={loginAction} />
    </div>
  );
}

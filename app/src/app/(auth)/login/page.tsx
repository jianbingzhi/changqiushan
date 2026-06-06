import Image from "next/image";
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
    // 先判 res.ok:反代返回非 JSON 错误体(如 502 HTML)时 res.json() 会抛,
    // 不先判会把"服务不可用"误并入"密码错误";结构化 JSON error(invalid_grant)走 res.ok=false 正常返回。
    if (!res.ok) return "账号或密码错误";
    data = await res.json();
    if (!data.access_token) return "账号或密码错误";
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
    <div className="grid min-h-screen lg:grid-cols-[1fr_480px]">
      {/* 左:导览图背景(桌面显示,移动端隐藏不下载) */}
      <div className="relative hidden lg:block">
        <Image
          src="/login-bg.webp"
          alt="长秋山森林公园导览图"
          fill
          priority
          sizes="(max-width: 1024px) 0px, 65vw"
          className="object-cover"
        />
        {/* 压暗遮罩:浅色轻压保证叠字可读,深色再加一层 */}
        <div className="absolute inset-0 bg-black/25 dark:bg-black/45" />
        <div className="absolute bottom-12 left-12 max-w-md text-white">
          <h2 className="text-3xl font-bold tracking-wide drop-shadow">长秋山森林公园智慧景区</h2>
          <p className="mt-3 text-base text-white/85 drop-shadow">全园免费 · 预约入园 · 智慧景区一体化管理</p>
        </div>
      </div>

      {/* 右:登录表单 */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[360px]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
              <svg width="28" height="22" viewBox="0 0 28 22" fill="none" aria-hidden="true">
                <path d="M2 20L8 8L14 15L19 7L26 20H2Z" fill="white" fillOpacity="0.92" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-foreground">长秋山森林公园智慧景区</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">管理后台</p>
          </div>
          <LoginForm action={loginAction} />
        </div>
      </div>
    </div>
  );
}

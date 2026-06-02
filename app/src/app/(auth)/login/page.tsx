import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "./_login-form";

export const metadata = {
  title: "登录 · 长秋山森林公园智慧景区管理后台",
};

async function loginAction(formData: FormData): Promise<string | never> {
  "use server";

  const phone    = (formData.get("phone") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!phone || !password) return "请填写手机号和密码";

  const GOTRUE_URL = process.env.GOTRUE_URL ?? "http://localhost:9999";

  let data: { access_token?: string };
  try {
    const res = await fetch(`${GOTRUE_URL}/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
      cache: "no-store",
    });
    data = await res.json();
    if (!res.ok || !data.access_token) return "手机号或密码错误";
  } catch {
    return "服务暂时不可用，请稍后重试";
  }

  const cookieStore = await cookies();
  cookieStore.set("sb-access-token", data.access_token, {
    httpOnly: true,
    path: "/",
    maxAge: 3600,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

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

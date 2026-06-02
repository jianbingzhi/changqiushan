"use client";

import { useActionState } from "react";
import { Input } from "@/lib/ui/input";
import { Button } from "@/lib/ui/button";

interface LoginFormProps {
  action: (formData: FormData) => Promise<string | never>;
}

export function LoginForm({ action }: LoginFormProps) {
  const [error, formAction, pending] = useActionState<string | null, FormData>(
    async (_prev, formData) => {
      const result = await action(formData);
      return result ?? null;
    },
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-[13px] font-medium text-[#1F2937]">
          手机号
        </label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="请输入手机号"
          autoComplete="tel"
          maxLength={11}
          disabled={pending}
          className="border-[#E5E7EB] focus-visible:ring-[#2D5A27]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[13px] font-medium text-[#1F2937]">
          密码
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="请输入密码"
          autoComplete="current-password"
          disabled={pending}
          className="border-[#E5E7EB] focus-visible:ring-[#2D5A27]"
        />
      </div>

      {error && (
        <p className="text-[13px] text-[#DC2626]" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="w-full mt-1 font-medium tracking-widest"
        style={{ backgroundColor: "#2D5A27", color: "#FFFFFF" }}
      >
        {pending ? "登录中…" : "登 录"}
      </Button>
    </form>
  );
}

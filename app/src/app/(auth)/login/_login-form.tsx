"use client";

import { useActionState } from "react";
import { User, Lock } from "lucide-react";
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
        <label htmlFor="account" className="text-[13px] font-medium text-foreground">
          手机号或邮箱
        </label>
        <Input
          id="account"
          name="account"
          type="text"
          placeholder="请输入手机号或邮箱"
          autoComplete="username"
          disabled={pending}
          startIcon={<User />}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[13px] font-medium text-foreground">
          密码
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="请输入密码"
          autoComplete="current-password"
          disabled={pending}
          startIcon={<Lock />}
        />
      </div>

      {error && (
        <p className="text-[13px] text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="w-full mt-1 font-medium tracking-widest"
      >
        {pending ? "登录中…" : "登 录"}
      </Button>
    </form>
  );
}

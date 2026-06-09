"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import { createAdminAction, disableAdminAction, resetPasswordAction } from "./actions";

const ROLE_OPTIONS: { code: string; label: string }[] = [
  { code: "SUPER_ADMIN", label: "超级管理员" },
  { code: "ADMIN", label: "管理员" },
  { code: "OPERATOR", label: "操作员" },
];

export function CreateAdminForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ phone: "", password: "", name: "", workerId: "", roleCode: "OPERATOR" });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    setMsg(null);
    startTransition(async () => {
      const res = await createAdminAction({
        phone: form.phone,
        password: form.password,
        name: form.name,
        workerId: form.workerId || undefined,
        roleCode: form.roleCode,
      });
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) {
        setForm({ phone: "", password: "", name: "", workerId: "", roleCode: "OPERATOR" });
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <div className="mb-4">
        <Button onClick={() => setOpen(true)}>新建账号</Button>
        {msg && <span className={`ml-3 text-[12px] ${msg.ok ? "text-primary" : "text-danger"}`}>{msg.text}</span>}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-muted p-4">
      <div className="grid grid-cols-2 gap-3 max-w-2xl">
        <div className="space-y-1"><label htmlFor="new-admin-phone" className="text-[12px] text-muted-foreground">手机号</label><Input id="new-admin-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="11 位手机号" /></div>
        <div className="space-y-1"><label htmlFor="new-admin-password" className="text-[12px] text-muted-foreground">初始密码</label><Input id="new-admin-password" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="至少 8 位" /></div>
        <div className="space-y-1"><label htmlFor="new-admin-name" className="text-[12px] text-muted-foreground">姓名</label><Input id="new-admin-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="真实姓名" /></div>
        <div className="space-y-1"><label htmlFor="new-admin-worker" className="text-[12px] text-muted-foreground">工号(选填)</label><Input id="new-admin-worker" value={form.workerId} onChange={(e) => set("workerId", e.target.value)} placeholder="如 OPS-001" /></div>
        <div className="space-y-1">
          <label htmlFor="new-admin-role" className="text-[12px] text-muted-foreground">角色</label>
          <select id="new-admin-role" value={form.roleCode} onChange={(e) => set("roleCode", e.target.value)} className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground">
            {ROLE_OPTIONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button onClick={submit} disabled={pending}>{pending ? "创建中…" : "确认创建"}</Button>
        <Button variant="outline" onClick={() => { setOpen(false); setMsg(null); }} disabled={pending}>取消</Button>
        {msg && <span className={`text-[12px] ${msg.ok ? "text-primary" : "text-danger"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

export function AccountRowActions({ profileId, disabled }: { profileId: string; disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [pwd, setPwd] = useState("");
  const pwdInputId = `reset-pwd-${profileId}`;

  function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(res.message);
      if (res.ok) {
        setResetting(false);
        setPwd("");
        router.refresh();
      }
    });
  }

  function submitReset() {
    if (pwd.length < 8) {
      setMsg("密码至少 8 位");
      return;
    }
    run(() => resetPasswordAction(profileId, pwd));
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="text-[12px]" disabled={pending} onClick={() => { setResetting((v) => !v); setMsg(null); }}>重置密码</Button>
        {!disabled && (
          <Button size="sm" variant="outline" className="text-[12px] text-danger border-[#FECACA]" disabled={pending} onClick={() => run(() => disableAdminAction(profileId))}>停用</Button>
        )}
      </div>
      {resetting && (
        <div className="flex items-center gap-2">
          <label htmlFor={pwdInputId} className="text-[12px] text-muted-foreground">新密码</label>
          <Input
            id={pwdInputId}
            type="password"
            value={pwd}
            autoFocus
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitReset();
              if (e.key === "Escape") { setResetting(false); setPwd(""); }
            }}
            placeholder="至少 8 位"
            className="h-8 w-44 text-[12px]"
          />
          <Button size="sm" className="text-[12px]" disabled={pending} onClick={submitReset}>{pending ? "提交中…" : "确认"}</Button>
          <Button size="sm" variant="outline" className="text-[12px]" disabled={pending} onClick={() => { setResetting(false); setPwd(""); }}>取消</Button>
        </div>
      )}
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}

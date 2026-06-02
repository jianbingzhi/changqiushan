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
        <Button onClick={() => setOpen(true)} style={{ backgroundColor: "#2D5A27", color: "#fff" }}>新建账号</Button>
        {msg && <span className={`ml-3 text-[12px] ${msg.ok ? "text-[#2D5A27]" : "text-[#DC2626]"}`}>{msg.text}</span>}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
      <div className="grid grid-cols-2 gap-3 max-w-2xl">
        <div className="space-y-1"><label className="text-[12px] text-[#6B7280]">手机号</label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="11 位手机号" /></div>
        <div className="space-y-1"><label className="text-[12px] text-[#6B7280]">初始密码</label><Input value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="至少 8 位" /></div>
        <div className="space-y-1"><label className="text-[12px] text-[#6B7280]">姓名</label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="真实姓名" /></div>
        <div className="space-y-1"><label className="text-[12px] text-[#6B7280]">工号(选填)</label><Input value={form.workerId} onChange={(e) => set("workerId", e.target.value)} placeholder="如 OPS-001" /></div>
        <div className="space-y-1">
          <label className="text-[12px] text-[#6B7280]">角色</label>
          <select value={form.roleCode} onChange={(e) => set("roleCode", e.target.value)} className="h-9 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#1F2937]">
            {ROLE_OPTIONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button onClick={submit} disabled={pending} style={{ backgroundColor: "#2D5A27", color: "#fff" }}>{pending ? "创建中…" : "确认创建"}</Button>
        <Button variant="outline" onClick={() => { setOpen(false); setMsg(null); }} disabled={pending}>取消</Button>
        {msg && <span className={`text-[12px] ${msg.ok ? "text-[#2D5A27]" : "text-[#DC2626]"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

export function AccountRowActions({ profileId, disabled }: { profileId: string; disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(res.message);
      if (res.ok) router.refresh();
    });
  }

  function resetPwd() {
    const pwd = window.prompt("输入新密码(至少 8 位)");
    if (!pwd) return;
    run(() => resetPasswordAction(profileId, pwd));
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="text-[12px]" disabled={pending} onClick={resetPwd}>重置密码</Button>
        {!disabled && (
          <Button size="sm" variant="outline" className="text-[12px] text-[#DC2626] border-[#FECACA]" disabled={pending} onClick={() => run(() => disableAdminAction(profileId))}>停用</Button>
        )}
      </div>
      {msg && <span className="text-[11px] text-[#6B7280]">{msg}</span>}
    </div>
  );
}

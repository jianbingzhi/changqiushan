"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import {
  saveDeviceAction,
  deleteDeviceAction,
  type DeviceActionResult,
  type DevicePayload,
} from "./actions";

export type DeviceRow = {
  id: string;
  name: string;
  type: string;
  location: string | null;
};

const EMPTY_FORM = {
  id: undefined as string | undefined,
  name: "",
  type: "",
  location: "",
};

type FormState = typeof EMPTY_FORM;

// 表单状态收口到一个 Provider:工具栏(新建按钮 + 内联表单)与各行操作(编辑/删除)共享。
type Ctx = {
  pending: boolean;
  form: FormState;
  open: boolean;
  msg: DeviceActionResult | null;
  startCreate: () => void;
  startEdit: (row: DeviceRow) => void;
  cancel: () => void;
  setForm: (updater: (f: FormState) => FormState) => void;
  submit: () => void;
  remove: (id: string) => void;
};

const DeviceCtx = createContext<Ctx | null>(null);

function useDeviceCtx(): Ctx {
  const ctx = useContext(DeviceCtx);
  if (!ctx) throw new Error("DeviceCtx 缺失:请在 DeviceProvider 内使用");
  return ctx;
}

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setFormState] = useState<FormState>({ ...EMPTY_FORM });
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<DeviceActionResult | null>(null);

  function run(fn: () => Promise<DeviceActionResult>, onOk?: () => void) {
    startTransition(async () => {
      const res = await fn();
      setMsg(res);
      if (res.ok) {
        onOk?.();
        router.refresh();
      }
    });
  }

  const ctx: Ctx = {
    pending,
    form,
    open,
    msg,
    startCreate() {
      setFormState({ ...EMPTY_FORM });
      setOpen(true);
      setMsg(null);
    },
    startEdit(row) {
      setFormState({ id: row.id, name: row.name, type: row.type, location: row.location ?? "" });
      setOpen(true);
      setMsg(null);
    },
    cancel() {
      setFormState({ ...EMPTY_FORM });
      setOpen(false);
    },
    setForm(updater) {
      setFormState(updater);
    },
    submit() {
      const payload: DevicePayload = {
        id: form.id,
        name: form.name.trim(),
        type: form.type.trim(),
        location: form.location.trim() || undefined,
      };
      run(() => saveDeviceAction(payload), () => {
        setFormState({ ...EMPTY_FORM });
        setOpen(false);
      });
    },
    remove(id) {
      run(() => deleteDeviceAction(id));
    },
  };

  return <DeviceCtx.Provider value={ctx}>{children}</DeviceCtx.Provider>;
}

export function DeviceToolbar() {
  const { pending, open, form, msg, startCreate, cancel, setForm, submit } = useDeviceCtx();

  return (
    <div className="mb-4">
      <div className="flex items-center justify-end">
        <Button size="sm" disabled={pending} onClick={startCreate} className="gap-1">
          <Plus className="h-4 w-4" />
          新建设备
        </Button>
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="dev-name" className="text-[12px] text-muted-foreground">设备名称</label>
            <Input id="dev-name" value={form.name} maxLength={80} placeholder="如:东门客流相机"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dev-type" className="text-[12px] text-muted-foreground">设备类型</label>
            <Input id="dev-type" value={form.type} maxLength={40} placeholder="如:客流相机 / 闸机 / 传感器"
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dev-location" className="text-[12px] text-muted-foreground">安装位置(选填)</label>
            <Input id="dev-location" value={form.location} maxLength={255} placeholder="如:东门入口"
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-3">
            <Button size="sm" disabled={pending} onClick={submit}>
              {pending ? "提交中…" : form.id ? "保存修改" : "确认新建"}
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={cancel}>
              取消
            </Button>
          </div>
        </div>
      )}

      {msg && (
        <p className={msg.ok ? "mt-3 text-[12px] text-success-strong" : "mt-3 text-[12px] text-danger-strong"}>
          {msg.message}
        </p>
      )}
    </div>
  );
}

export function DeviceRowActions({ row }: { row: DeviceRow }) {
  const { pending, startEdit, remove } = useDeviceCtx();
  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => startEdit(row)} className="h-7 gap-1 px-2">
        <Pencil className="h-3.5 w-3.5" />
        编辑
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`确认删除设备「${row.name}」?该设备的心跳历史将一并删除,不可恢复。`)) remove(row.id);
        }}
        className="h-7 gap-1 px-2 text-danger-strong hover:text-danger-strong"
      >
        <Trash2 className="h-3.5 w-3.5" />
        删除
      </Button>
    </div>
  );
}

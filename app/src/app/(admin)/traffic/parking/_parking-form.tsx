"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import {
  saveParkingLotAction,
  deleteParkingLotAction,
  type ParkingActionResult,
  type ParkingLotPayload,
} from "./actions";

type Status = "OPEN" | "FULL" | "CLOSED";

const STATUS_LABEL: Record<Status, string> = {
  OPEN: "开放",
  FULL: "满位",
  CLOSED: "关闭",
};
const STATUSES: Status[] = ["OPEN", "FULL", "CLOSED"];

export type ParkingLotRow = {
  id: string;
  name: string;
  capacity: number;
  status: Status;
  location: string | null;
  lng: number | null;
  lat: number | null;
};

const EMPTY_FORM = {
  id: undefined as string | undefined,
  name: "",
  capacity: "",
  status: "OPEN" as Status,
  location: "",
  lng: "",
  lat: "",
};

const selectCls =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

function Msg({ msg }: { msg: ParkingActionResult | null }) {
  if (!msg) return null;
  return (
    <p className={msg.ok ? "mt-3 text-[13px] text-success" : "mt-3 text-[13px] text-danger"}>
      {msg.message}
    </p>
  );
}

export function ParkingForm({ lots }: { lots: ParkingLotRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<ParkingActionResult | null>(null);

  function run(fn: () => Promise<ParkingActionResult>, onOk?: () => void) {
    startTransition(async () => {
      const res = await fn();
      setMsg(res);
      if (res.ok) {
        onOk?.();
        router.refresh();
      }
    });
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setOpen(true);
    setMsg(null);
  }

  function openEdit(lot: ParkingLotRow) {
    setForm({
      id: lot.id,
      name: lot.name,
      capacity: String(lot.capacity),
      status: lot.status,
      location: lot.location ?? "",
      lng: lot.lng != null ? String(lot.lng) : "",
      lat: lot.lat != null ? String(lot.lat) : "",
    });
    setOpen(true);
    setMsg(null);
  }

  function submit() {
    const hasCoord = form.lng.trim() !== "" && form.lat.trim() !== "";
    const payload: ParkingLotPayload = {
      id: form.id,
      name: form.name.trim(),
      capacity: Number(form.capacity) || 0,
      status: form.status,
      location: form.location.trim() || undefined,
      coordinates: hasCoord ? { lng: Number(form.lng), lat: Number(form.lat) } : null,
    };
    run(() => saveParkingLotAction(payload), () => {
      setForm({ ...EMPTY_FORM });
      setOpen(false);
    });
  }

  return (
    <section className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-foreground">停车场维护</h2>
        <Button size="sm" onClick={openCreate} className="gap-1">
          <Plus className="h-4 w-4" />
          新建停车场
        </Button>
      </div>
      <p className="mb-3 text-[12px] text-text-muted">
        维护停车场名称、总车位、状态与上图坐标;已占用车位由设备同步链路实时写入,不在此处填写。
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">停车场名称</th>
              <th className="py-2 pr-3 text-right font-medium">总车位</th>
              <th className="py-2 pr-3 font-medium">状态</th>
              <th className="py-2 pr-3 font-medium">位置</th>
              <th className="py-2 pr-3 font-medium">坐标</th>
              <th className="py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {lots.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-text-muted">
                  暂无停车场,点击「新建停车场」开始录入
                </td>
              </tr>
            ) : (
              lots.map((lot) => (
                <tr key={lot.id} className="border-b border-border-light last:border-0">
                  <td className="py-2 pr-3 font-medium text-foreground">{lot.name}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{lot.capacity}</td>
                  <td className="py-2 pr-3">{STATUS_LABEL[lot.status]}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{lot.location || "—"}</td>
                  <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                    {lot.lng != null && lot.lat != null ? `${lot.lng}, ${lot.lat}` : "—"}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => openEdit(lot)} className="h-7 gap-1 px-2">
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm(`确认删除停车场「${lot.name}」?此操作不可恢复。`)) run(() => deleteParkingLotAction(lot.id));
                        }}
                        className="h-7 gap-1 px-2 text-danger hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border-light pt-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="lot-name" className="text-[12px] text-muted-foreground">停车场名称</label>
            <Input id="lot-name" value={form.name} maxLength={80} placeholder="如:游客中心停车场"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lot-capacity" className="text-[12px] text-muted-foreground">总车位</label>
            <Input id="lot-capacity" type="number" min={0} placeholder="0" value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lot-status" className="text-[12px] text-muted-foreground">状态</label>
            <select id="lot-status" className={selectCls} value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <label htmlFor="lot-location" className="text-[12px] text-muted-foreground">位置描述(选填)</label>
            <Input id="lot-location" value={form.location} maxLength={255} placeholder="如:景区南门入口右侧"
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lot-lng" className="text-[12px] text-muted-foreground">经度(选填)</label>
            <Input id="lot-lng" type="number" step="any" placeholder="如:103.85" value={form.lng}
              onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lot-lat" className="text-[12px] text-muted-foreground">纬度(选填)</label>
            <Input id="lot-lat" type="number" step="any" placeholder="如:30.05" value={form.lat}
              onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))} />
          </div>
          <div className="col-span-2 flex items-center gap-2 sm:col-span-3">
            <Button size="sm" disabled={pending} onClick={submit}>
              {pending ? "提交中…" : form.id ? "保存修改" : "确认新建"}
            </Button>
            <Button size="sm" variant="outline" disabled={pending}
              onClick={() => { setForm({ ...EMPTY_FORM }); setOpen(false); }}>
              取消
            </Button>
          </div>
        </div>
      )}
      <Msg msg={msg} />
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import {
  createSlotAction,
  copyPrevDaySlotsAction,
  type SlotActionResult,
} from "./actions";

const QUOTA_FIELDS = [
  { key: "miniProgramQuota", label: "小程序" },
  { key: "onsiteQuota", label: "现场" },
  { key: "otaQuota", label: "第三方平台" },
  { key: "adminQuota", label: "后台" },
] as const;

type QuotaKey = (typeof QUOTA_FIELDS)[number]["key"];

const EMPTY = {
  name: "",
  startTime: "",
  endTime: "",
  miniProgramQuota: "",
  onsiteQuota: "",
  otaQuota: "",
  adminQuota: "",
};

export function SlotTools({ targetDate }: { targetDate: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState<SlotActionResult | null>(null);

  function run(fn: () => Promise<SlotActionResult>, onOk?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(res);
      if (res.ok) {
        onOk?.();
        router.refresh();
      }
    });
  }

  function submitCreate() {
    run(
      () =>
        createSlotAction({
          date: targetDate,
          name: form.name.trim(),
          startTime: form.startTime,
          endTime: form.endTime,
          miniProgramQuota: Number(form.miniProgramQuota) || 0,
          onsiteQuota: Number(form.onsiteQuota) || 0,
          otaQuota: Number(form.otaQuota) || 0,
          adminQuota: Number(form.adminQuota) || 0,
        }),
      () => setForm(EMPTY),
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-[#E5E7EB] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setOpen((v) => !v)} className="gap-1">
          <Plus className="h-4 w-4" />
          新建时段
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => copyPrevDaySlotsAction(targetDate))}
          className="gap-1"
        >
          <Copy className="h-4 w-4" />
          复制前一天时段到本日
        </Button>
        <span className="text-xs text-[#9CA3AF]">运营可在此为本日补建时段（仅管理及以上）</span>
      </div>

      {msg && (
        <p
          className={
            msg.ok
              ? "mt-3 text-[13px] text-[#16A34A]"
              : "mt-3 text-[13px] text-[#DC2626]"
          }
        >
          {msg.message}
        </p>
      )}

      {open && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#F3F4F6] pt-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="slot-name" className="text-xs text-[#6B7280]">时段名</label>
            <Input
              id="slot-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="如：上午场"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="slot-start" className="text-xs text-[#6B7280]">开始时间</label>
            <Input
              id="slot-start"
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="slot-end" className="text-xs text-[#6B7280]">结束时间</label>
            <Input
              id="slot-end"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </div>
          {QUOTA_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <label htmlFor={`slot-${key}`} className="text-xs text-[#6B7280]">{label}名额</label>
              <Input
                id={`slot-${key}`}
                type="number"
                min={0}
                value={form[key as QuotaKey]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder="0"
              />
            </div>
          ))}
          <div className="col-span-2 flex items-center gap-2 sm:col-span-3">
            <Button size="sm" disabled={pending} onClick={submitCreate}>
              {pending ? "提交中…" : "确认新建"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setForm(EMPTY);
                setOpen(false);
              }}
            >
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

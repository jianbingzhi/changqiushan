"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/lib/ui/sheet";
import { saveChannelAction, toggleChannelAction, type ChannelActionResult } from "./actions";

export type ChannelRow = {
  code: string;
  label: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
};

const labelCls = "block text-[12px] font-medium text-muted-foreground";

export function Channels({ channels }: { channels: ChannelRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<ChannelActionResult | null>(null);

  const [open, setOpen] = React.useState(false);
  const [editCode, setEditCode] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState("0");

  const openEditor = (ch: ChannelRow) => {
    setEditCode(ch.code);
    setLabel(ch.label);
    setDescription(ch.description);
    setSortOrder(String(ch.sortOrder));
    setMsg(null);
    setOpen(true);
  };

  const submit = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await saveChannelAction(editCode, {
        label: label.trim(),
        description: description.trim(),
        sortOrder: Number(sortOrder) || 0,
      });
      setMsg(res);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  };

  const toggle = (ch: ChannelRow) => {
    setMsg(null);
    startTransition(async () => {
      const res = await toggleChannelAction(ch.code, !ch.enabled);
      setMsg(res);
      if (res.ok) router.refresh();
    });
  };

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">渠道名称</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">说明</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">排序</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr key={ch.code} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{ch.label}</td>
                <td className="px-4 py-3 text-muted-foreground">{ch.description}</td>
                <td className="px-4 py-3 text-muted-foreground">{ch.sortOrder}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${
                      ch.enabled
                        ? "border-success/30 bg-success/10 text-success-strong"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {ch.enabled ? "已启用" : "已停用"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => openEditor(ch)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />编辑
                    </Button>
                    <Button
                      variant={ch.enabled ? "outline" : "default"}
                      size="sm"
                      disabled={pending}
                      onClick={() => toggle(ch)}
                    >
                      {ch.enabled ? "停用" : "启用"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && (
        <p className={`mt-3 text-[13px] ${msg.ok ? "text-success-strong" : "text-danger-strong"}`}>{msg.message}</p>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>编辑渠道配置</SheetTitle>
            <p className="text-[12px] text-muted-foreground">渠道为固定接入类型,仅可改名称/说明/排序与启停</p>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="ch-label">渠道名称</label>
              <Input id="ch-label" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} className="text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="ch-desc">说明</label>
              <Input id="ch-desc" value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)} className="text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="ch-sort">排序(小在前)</label>
              <Input id="ch-sort" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="text-[13px]" />
            </div>
          </div>
          <SheetFooter className="mt-auto">
            <Button size="sm" disabled={pending} onClick={submit}>
              {pending ? "保存中…" : "保存"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

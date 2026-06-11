"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, Trash2, Copy, Check } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { formatCnDate } from "@/shared/format";
import { deleteAssetAction, type AssetActionResult } from "./actions";
import { useImageUpload } from "../_use-image-upload";

export type AssetRow = {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: string;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AssetLibrary({ assets }: { assets: AssetRow[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const { busy, uploadImage } = useImageUpload();
  const [msg, setMsg] = useState<AssetActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选同一文件
    if (!file) return;

    setMsg(null);
    const res = await uploadImage(file);
    setMsg({ ok: res.ok, message: res.message });
    if (res.ok) router.refresh();
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteAssetAction(id);
      setMsg(res);
      if (res.ok) router.refresh();
    });
  }

  async function copyUrl(asset: AssetRow) {
    try {
      await navigator.clipboard.writeText(asset.url);
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId((c) => (c === asset.id ? null : c)), 1500);
    } catch {
      /* clipboard 不可用时忽略 */
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onPick} />
        <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()} className="gap-1">
          <Upload className="h-4 w-4" />
          {busy ? "上传中…" : "上传图片素材"}
        </Button>
        <span className="text-xs text-muted-foreground">支持 JPG / PNG / WebP / GIF,单张 10MB 以内;视频经内容编辑器上传后也在此归档</span>
      </div>

      {msg && (
        <p className={msg.ok ? "text-[13px] text-success" : "text-[13px] text-destructive"}>
          {msg.message}
        </p>
      )}

      {assets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
          暂无素材,点击「上传图片素材」添加
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="relative aspect-video bg-muted">
                {/* b-103 评审 #4:mp4 走 <video> 出首帧,塞进 <img> 必裂图 */}
                {a.type.startsWith("video/") ? (
                  <video src={a.url} preload="metadata" muted className="h-full w-full object-cover" aria-label={a.name} />
                ) : (
                  <Image src={a.url} alt={a.name} fill sizes="(max-width:1024px) 50vw, 25vw" className="object-cover" unoptimized />
                )}
                {a.type.startsWith("video/") && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-foreground/70 px-1.5 py-0.5 text-[12px] text-background">视频</span>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-[13px] font-medium text-foreground" title={a.name}>{a.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {humanSize(a.size)} · {formatCnDate(a.createdAt)}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => copyUrl(a)} className="h-7 gap-1 px-2 text-xs">
                    {copiedId === a.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === a.id ? "已复制" : "复制链接"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => onDelete(a.id)}
                    className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

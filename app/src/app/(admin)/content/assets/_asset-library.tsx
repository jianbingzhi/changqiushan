"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, Trash2, Copy, Check } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { formatCnDate } from "@/shared/format";
import {
  presignUploadAction,
  commitAssetAction,
  deleteAssetAction,
  type AssetActionResult,
} from "./actions";

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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<AssetActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选同一文件
    if (!file) return;

    setBusy(true);
    setMsg(null);
    try {
      // 1) 取预签名(服务端校验类型/大小 + 派生 key)
      const presign = await presignUploadAction({ contentType: file.type, size: file.size });
      if (!presign.ok) {
        setMsg({ ok: false, message: presign.message });
        return;
      }
      // 2) 浏览器直传到对象存储(不经服务端,省内存/时长)
      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        setMsg({ ok: false, message: "直传失败,请检查存储服务可达性" });
        return;
      }
      // 3) 提交:转存 public + 归档
      const commit = await commitAssetAction({
        stagingKey: presign.key,
        name: file.name,
        contentType: file.type,
        size: file.size,
      });
      setMsg(commit);
      if (commit.ok) router.refresh();
    } catch {
      setMsg({ ok: false, message: "上传出错,请重试" });
    } finally {
      setBusy(false);
    }
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
        <span className="text-xs text-muted-foreground">支持 JPG / PNG / WebP / GIF,单张 10MB 以内</span>
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
                <Image src={a.url} alt={a.name} fill sizes="(max-width:1024px) 50vw, 25vw" className="object-cover" unoptimized />
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

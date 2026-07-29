"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Upload, X, Library } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { formatCnDate } from "@/shared/format";
import { useImageUpload } from "./_use-image-upload";
import { listAssetsAction, type AssetPickRow } from "./assets/actions";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// 封面图字段:上传(预签名直传)或从素材库选择,产出公网 URL。取代原"输入图片地址"。
// variant="banner" = 文档模式的宽幅封面(16:5),"field" = 紧凑缩略图。
export function ImageUploadField({
  value,
  onChange,
  variant = "field",
}: {
  value: string;
  onChange: (url: string) => void;
  variant?: "field" | "banner";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { busy, uploadImage } = useImageUpload();
  const [msg, setMsg] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMsg(null);
    const res = await uploadImage(file);
    if (res.ok && res.url) onChange(res.url);
    else setMsg(res.message);
  }

  const pickerModal = picking && (
    <AssetPickerModal
      onClose={() => setPicking(false)}
      onSelect={(url) => { onChange(url); setPicking(false); }}
    />
  );

  if (variant === "banner") {
    return (
      <div>
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onPick} />
        {value ? (
          <div className="group relative aspect-[16/5] w-full overflow-hidden rounded-xl border border-border bg-muted">
            <Image src={value} alt="封面预览" fill sizes="(max-width:1024px) 100vw, 760px" className="object-cover" unoptimized />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()} className="bg-card/90">
                <Upload className="h-3.5 w-3.5" />{busy ? "上传中…" : "更换"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPicking(true)} className="bg-card/90">
                <Library className="h-3.5 w-3.5" />素材库
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onChange("")} className="bg-card/90 text-danger-strong hover:text-danger-strong">
                <X className="h-3.5 w-3.5" />移除
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="flex aspect-[16/5] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-primary-strong disabled:opacity-50"
            >
              <ImagePlus className="h-7 w-7" />
              <span className="text-sm">{busy ? "上传中…" : "添加封面图(点击上传)"}</span>
            </button>
            <div className="absolute bottom-3 right-3">
              <Button type="button" size="sm" variant="outline" onClick={() => setPicking(true)} className="bg-card">
                <Library className="h-3.5 w-3.5" />从素材库选择
              </Button>
            </div>
          </div>
        )}
        {msg && <p className="mt-1.5 text-[13px] text-danger-strong">{msg}</p>}
        {pickerModal}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onPick} />

      {value ? (
        <div className="flex items-start gap-3">
          <div className="relative h-28 w-44 overflow-hidden rounded-lg border border-border bg-muted">
            <Image src={value} alt="封面预览" fill sizes="176px" className="object-cover" unoptimized />
          </div>
          <div className="flex flex-col gap-1.5">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />{busy ? "上传中…" : "更换图片"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPicking(true)}>
              <Library className="h-3.5 w-3.5" />从素材库选择
            </Button>
            <Button type="button" size="sm" variant="ghost" className="text-danger-strong hover:text-danger-strong" onClick={() => onChange("")}>
              <X className="h-3.5 w-3.5" />移除封面
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex h-28 w-44 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-primary-strong disabled:opacity-50"
          >
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs">{busy ? "上传中…" : "上传封面"}</span>
          </button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPicking(true)}>
            <Library className="h-3.5 w-3.5" />从素材库选择
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">支持 JPG / PNG / WebP / GIF,单张 10MB 以内</p>
      {msg && <p className="text-[13px] text-danger-strong">{msg}</p>}

      {picking && (
        <AssetPickerModal
          onClose={() => setPicking(false)}
          onSelect={(url) => { onChange(url); setPicking(false); }}
        />
      )}
    </div>
  );
}

function AssetPickerModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const [rows, setRows] = useState<AssetPickRow[] | null>(null);

  // 打开即拉素材列表(挂载一次)
  useEffect(() => {
    let alive = true;
    listAssetsAction().then((r) => alive && setRows(r)).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">从素材库选择封面</h3>
          <button type="button" aria-label="关闭" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[64vh] overflow-y-auto p-5">
          {rows === null ? (
            <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">素材库暂无图片,请先到「媒体素材库」上传</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {rows.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelect(a.url)}
                  className="group overflow-hidden rounded-lg border border-border bg-card text-left hover:border-primary"
                >
                  <div className="relative aspect-video bg-muted">
                    <Image src={a.url} alt={a.name} fill sizes="(max-width:1024px) 50vw, 25vw" className="object-cover" unoptimized />
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-foreground" title={a.name}>{a.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{humanSize(a.size)} · {formatCnDate(a.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

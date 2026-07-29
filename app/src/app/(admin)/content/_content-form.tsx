"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/lib/ui/page-header";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import { formatCnDate } from "@/shared/format";
import { RichTextEditor } from "@/lib/ui/editor/RichTextEditor";
import { ImageUploadField } from "./_image-upload-field";
import { useImageUpload } from "./_use-image-upload";
import { saveContentAction, type ContentModel } from "./_actions";

type FieldKind = "text" | "textarea" | "url" | "number" | "date" | "cover";
interface MetaField { key: string; label: string; kind: FieldKind; required?: boolean }

// 各模型的富正文字段 + 标题文案
const RICH_FIELD: Record<ContentModel, { key: string; label: string }> = {
  intro:     { key: "body",        label: "正文" },
  news:      { key: "body",        label: "正文" },
  activity:  { key: "description", label: "活动详情" },
  knowledge: { key: "content",     label: "内容" },
};

// 富正文外的元数据字段(按表单顺序)
const META_FIELDS: Record<ContentModel, MetaField[]> = {
  intro: [
    { key: "coverImage", label: "封面图(选填)", kind: "cover" },
  ],
  news: [
    { key: "summary",    label: "摘要(选填)", kind: "textarea" },
    { key: "coverImage", label: "封面图(选填)", kind: "cover" },
  ],
  activity: [
    { key: "coverImage",      label: "封面图(选填)", kind: "cover" },
    { key: "startDate",       label: "开始日期", kind: "date", required: true },
    { key: "endDate",         label: "结束日期", kind: "date", required: true },
    { key: "maxParticipants", label: "人数上限(选填)", kind: "number" },
    { key: "registrationFee", label: "报名费(元,0 为免费)", kind: "number" },
  ],
  knowledge: [
    { key: "category",  label: "分类(选填)", kind: "text" },
  ],
};

const MODEL_TITLE: Record<ContentModel, string> = {
  intro: "景区介绍", news: "资讯", activity: "活动", knowledge: "知识条目",
};

function toInputValue(v: unknown, kind: FieldKind): string {
  if (v === null || v === undefined) return "";
  if (kind === "date") {
    const d = typeof v === "string" ? new Date(v) : (v as Date);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return String(v);
}

const isRichEmpty = (html: string) => !html || html === "<p></p>" || html.trim() === "";

export function ContentForm({
  model,
  id,
  initial,
}: {
  model: ContentModel;
  id?: string;
  initial?: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const { uploadImage, uploadVideo } = useImageUpload();
  const richKey = RICH_FIELD[model].key;
  const metaFields = META_FIELDS[model];

  const [title, setTitle] = useState<string>(toInputValue(initial?.title, "text"));
  const [rich, setRich] = useState<string>(typeof initial?.[richKey] === "string" ? (initial![richKey] as string) : "");
  const [meta, setMeta] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const f of metaFields) m[f.key] = toInputValue(initial?.[f.key], f.kind);
    return m;
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const setMetaVal = (k: string, v: string) => setMeta((s) => ({ ...s, [k]: v }));

  function submit() {
    setError(null);
    if (!title.trim()) { setError("请填写标题"); return; }
    if (isRichEmpty(rich)) { setError(`请填写${RICH_FIELD[model].label}`); return; }
    for (const f of metaFields) {
      if (f.required && !meta[f.key]) { setError(`请填写${f.label}`); return; }
    }
    const payload: Record<string, unknown> = { title: title.trim(), [richKey]: rich };
    for (const f of metaFields) {
      const v = meta[f.key];
      if (v !== "") payload[f.key] = v; // 空的选填项不提交,由 zod 默认/可选处理
    }
    startTransition(async () => {
      const res = await saveContentAction(model, id ?? null, payload);
      // 成功时 action 内 redirect 抛出导航,不会有返回值;有返回值即错误
      if (res && !res.ok) setError(res.message);
    });
  }

  const coverField = metaFields.find((f) => f.kind === "cover");
  const summaryField = metaFields.find((f) => f.kind === "textarea");
  const sidebarFields = metaFields.filter((f) => f.kind !== "cover" && f.kind !== "textarea");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${id ? "编辑" : "新建"}${MODEL_TITLE[model]}`}
        description="文档式编辑:封面 + 标题 + 正文连贯撰写,右侧设置属性。保存后为草稿,需在列表中发布"
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* 文档画布 */}
        <div className="min-w-0 flex-1 rounded-xl border border-border bg-card px-6 py-7 shadow-sm sm:px-10 sm:py-9">
          {coverField && (
            <div className="mb-7">
              <ImageUploadField variant="banner" value={meta[coverField.key]} onChange={(url) => setMetaVal(coverField.key, url)} />
            </div>
          )}

          <input
            aria-label="标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入标题"
            maxLength={80}
            className="w-full border-0 bg-transparent p-0 text-3xl font-bold leading-snug text-foreground placeholder:text-text-muted focus:outline-none focus:ring-0"
          />

          {summaryField && (
            <textarea
              aria-label={summaryField.label}
              value={meta[summaryField.key]}
              onChange={(e) => setMetaVal(summaryField.key, e.target.value)}
              placeholder="添加摘要(选填)…"
              rows={2}
              className="mt-3 w-full resize-none border-0 bg-transparent p-0 text-base leading-relaxed text-muted-foreground placeholder:text-text-muted focus:outline-none focus:ring-0"
            />
          )}

          <div className="my-5 h-px bg-border" />

          <RichTextEditor
            variant="document"
            value={rich}
            onChange={setRich}
            onUploadImage={uploadImage}
            onUploadVideo={uploadVideo}
            placeholder={`开始撰写${RICH_FIELD[model].label}…`}
          />
        </div>

        {/* 属性侧栏 */}
        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-72">
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">文档属性</h3>

            {sidebarFields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label htmlFor={`cf-${f.key}`} className="text-[13px] font-medium text-foreground">
                  {f.label}{f.required && <span className="text-danger-strong">*</span>}
                </label>
                <Input
                  id={`cf-${f.key}`}
                  type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"}
                  value={meta[f.key]}
                  onChange={(e) => setMetaVal(f.key, e.target.value)}
                  placeholder={f.kind === "url" ? "https://…" : undefined}
                />
                {f.kind === "date" && meta[f.key] && (
                  <p className="text-xs text-text-muted">{formatCnDate(meta[f.key])}</p>
                )}
              </div>
            ))}

            <p className="text-xs leading-relaxed text-text-muted">保存后为草稿,需在列表中点「发布」上线。</p>

            {error && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger-strong">{error}</p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button onClick={submit} disabled={pending}>{pending ? "保存中…" : "保存"}</Button>
              <Button variant="outline" onClick={() => router.back()} disabled={pending}>取消</Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

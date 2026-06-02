"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/lib/ui/page-header";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import { RichTextEditor } from "@/lib/ui/editor/RichTextEditor";
import { saveContentAction, type ContentModel } from "./_actions";

type FieldKind = "text" | "textarea" | "url" | "number" | "date";
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
    { key: "coverImage", label: "封面图地址(URL,选填)", kind: "url" },
    { key: "sortOrder",  label: "排序(数字越小越靠前)", kind: "number" },
  ],
  news: [
    { key: "summary",    label: "摘要(选填)", kind: "textarea" },
    { key: "coverImage", label: "封面图地址(URL,选填)", kind: "url" },
  ],
  activity: [
    { key: "coverImage",      label: "封面图地址(URL,选填)", kind: "url" },
    { key: "startDate",       label: "开始日期", kind: "date", required: true },
    { key: "endDate",         label: "结束日期", kind: "date", required: true },
    { key: "maxParticipants", label: "人数上限(选填)", kind: "number" },
    { key: "registrationFee", label: "报名费(元,0 为免费)", kind: "number" },
  ],
  knowledge: [
    { key: "category",  label: "分类(选填)", kind: "text" },
    { key: "sortOrder", label: "排序(数字越小越靠前)", kind: "number" },
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

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`${id ? "编辑" : "新建"}${MODEL_TITLE[model]}`}
        description="正文支持富文本(加粗/标题/列表/链接/图片);保存后为草稿,需在列表中发布"
      />
      <div className="space-y-5 rounded-xl border border-[#E5E7EB] bg-white p-6">
        <div className="space-y-1.5">
          <label htmlFor="cf-title" className="text-sm font-medium text-[#1F2937]">标题</label>
          <Input id="cf-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="请输入标题" maxLength={80} />
        </div>

        {metaFields.filter((f) => f.kind === "textarea").map((f) => (
          <div key={f.key} className="space-y-1.5">
            <label htmlFor={`cf-${f.key}`} className="text-sm font-medium text-[#1F2937]">{f.label}</label>
            <textarea
              id={`cf-${f.key}`}
              value={meta[f.key]}
              onChange={(e) => setMetaVal(f.key, e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/30"
            />
          </div>
        ))}

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-[#1F2937]">{RICH_FIELD[model].label}</span>
          <RichTextEditor value={rich} onChange={setRich} placeholder={`请输入${RICH_FIELD[model].label}…`} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {metaFields.filter((f) => f.kind !== "textarea").map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label htmlFor={`cf-${f.key}`} className="text-sm font-medium text-[#1F2937]">{f.label}</label>
              <Input
                id={`cf-${f.key}`}
                type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"}
                value={meta[f.key]}
                onChange={(e) => setMetaVal(f.key, e.target.value)}
                placeholder={f.kind === "url" ? "https://…" : undefined}
              />
            </div>
          ))}
        </div>

        {error && <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#DC2626]">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <Button onClick={submit} disabled={pending} style={{ backgroundColor: "#2D5A27", color: "#fff" }}>
            {pending ? "保存中…" : "保存"}
          </Button>
          <Button variant="outline" onClick={() => router.back()} disabled={pending}>取消</Button>
        </div>
      </div>
    </div>
  );
}

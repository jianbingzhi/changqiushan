"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold, Italic, Strikethrough, Heading2, Heading3,
  List, ListOrdered, Quote, Link2, ImageIcon, ImageUp, Undo2, Redo2,
} from "lucide-react";
import { cn } from "@/lib/ui/utils";

// 图片直传由调用方(app 层)注入,保持本组件在 lib 层不依赖 app 的 server action(架构边界)。
export type UploadImage = (file: File) => Promise<{ ok: boolean; url?: string; message: string }>;

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onUploadImage?: UploadImage;
  // "document" = Word 式文档画布:无外框、工具栏吸顶、正文区更高
  variant?: "default" | "document";
}

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

function ToolbarButton({
  onClick, active, disabled, label, children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-40",
        active && "bg-[#E8F0E6] text-[#2D5A27]",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, onUploadImage }: { editor: Editor; onUploadImage?: UploadImage }) {
  // a11y:用内联受控输入替代原生弹窗(读屏不可达、不可键盘取消)
  const [field, setField] = useState<null | "link" | "image">(null);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlInputId = useId(); // 同页多实例时 label/input 关联不撞 id

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadImage) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const res = await onUploadImage(file);
      if (res.ok && res.url) editor.chain().focus().setImage({ src: res.url }).run();
      else setUploadErr(res.message);
    } finally {
      setUploading(false);
    }
  }

  const openLink = () => {
    setUrl((editor.getAttributes("link").href as string | undefined) ?? "https://");
    setField("link");
  };
  const openImage = () => {
    setUrl("https://");
    setField("image");
  };
  const close = () => { setField(null); setUrl(""); };

  const submit = () => {
    const v = url.trim();
    if (field === "link") {
      if (v === "") editor.chain().focus().unsetLink().run();
      else editor.chain().focus().extendMarkRange("link").setLink({ href: v }).run();
    } else if (field === "image" && v) {
      editor.chain().focus().setImage({ src: v }).run();
    }
    close();
  };

  return (
    <>
      <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={onPickFile} />
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[#E5E7EB] bg-[#FAFAFA] px-2 py-1.5" role="toolbar" aria-label="富文本格式工具栏">
        <ToolbarButton label="加粗" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="斜体" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="删除线" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-[#E5E7EB]" />
        <ToolbarButton label="二级标题" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="三级标题" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="无序列表" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="有序列表" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="引用" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-[#E5E7EB]" />
        <ToolbarButton label="插入链接" active={editor.isActive("link") || field === "link"} onClick={openLink}><Link2 className="h-4 w-4" /></ToolbarButton>
        {/* 图片按钮:有上传能力则直接打开文件选择上传;否则退回填图片地址 */}
        <ToolbarButton
          label={onUploadImage ? "上传图片" : "插入图片(图片地址)"}
          disabled={uploading}
          active={field === "image"}
          onClick={onUploadImage ? () => fileRef.current?.click() : openImage}
        >
          {onUploadImage ? <ImageUp className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-[#E5E7EB]" />
        <ToolbarButton label="撤销" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="重做" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></ToolbarButton>
        {uploading && <span className="ml-1 text-[12px] text-[#6B7280]">图片上传中…</span>}
      </div>

      {uploadErr && <p className="border-b border-[#E5E7EB] bg-[#FEF2F2] px-3 py-1.5 text-[12px] text-[#DC2626]">{uploadErr}</p>}

      {field && (
        <div className="flex items-center gap-2 border-b border-[#E5E7EB] bg-white px-3 py-2">
          <label htmlFor={urlInputId} className="shrink-0 text-[12px] text-[#6B7280]">
            {field === "link" ? "链接地址(留空移除链接)" : "图片地址"}
          </label>
          <input
            id={urlInputId}
            type="url"
            value={url}
            autoFocus
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); submit(); }
              if (e.key === "Escape") close();
            }}
            placeholder="https://…"
            className="h-8 flex-1 rounded-md border border-[#E5E7EB] px-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/30"
          />
          <button type="button" onClick={submit} className="shrink-0 rounded-md bg-[#2D5A27] px-3 py-1 text-[12px] text-white">
            {field === "link" ? "应用" : "插入"}
          </button>
          <button type="button" onClick={close} className="shrink-0 rounded-md border border-[#E5E7EB] px-3 py-1 text-[12px] text-[#6B7280]">取消</button>
        </div>
      )}
    </>
  );
}

export function RichTextEditor({ value, onChange, placeholder, onUploadImage, variant = "default" }: Props) {
  const documentMode = variant === "document";
  // 拖入/粘贴的 handler 在 useEditor 初始化时固化,用 ref 取最新的上传函数。
  const uploadRef = useRef<UploadImage | undefined>(onUploadImage);
  useEffect(() => { uploadRef.current = onUploadImage; }, [onUploadImage]);

  const editor = useEditor({
    immediatelyRender: false, // Next SSR 安全:避免水合不一致
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, HTMLAttributes: { class: "text-[#2D5A27] underline" } },
      }),
      Image.configure({ HTMLAttributes: { class: "max-w-full rounded-lg" } }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: documentMode
          ? "richtext-content min-h-[460px] px-2 py-4 text-[15px] leading-7 focus:outline-none"
          : "richtext-content min-h-[220px] px-4 py-3 focus:outline-none",
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
      // 粘贴图片 → 直传后在光标处插入
      handlePaste: (view, event) => {
        const img = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
        if (!img || !uploadRef.current) return false;
        event.preventDefault();
        void uploadRef.current(img).then((res) => {
          if (res.ok && res.url) {
            const node = view.state.schema.nodes.image.create({ src: res.url });
            view.dispatch(view.state.tr.replaceSelectionWith(node));
          }
        });
        return true;
      },
      // 拖入图片 → 直传后在落点处插入
      handleDrop: (view, event) => {
        const img = Array.from(event.dataTransfer?.files ?? []).find((f) => f.type.startsWith("image/"));
        if (!img || !uploadRef.current) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void uploadRef.current(img).then((res) => {
          if (res.ok && res.url) {
            const node = view.state.schema.nodes.image.create({ src: res.url });
            const pos = at ?? view.state.selection.from;
            view.dispatch(view.state.tr.insert(pos, node));
          }
        });
        return true;
      },
    },
  });

  if (!editor) {
    return <div className="min-h-[260px] rounded-lg border border-[#E5E7EB] bg-white" aria-busy="true" />;
  }

  // 选中文字浮现的气泡工具栏(Word/Notion 手感):仅常用格式,避免与主工具栏重复过多。
  const bubble = (
    <BubbleMenu editor={editor} options={{ placement: "top" }}>
      <div className="flex items-center gap-0.5 rounded-lg border border-[#E5E7EB] bg-white p-1 shadow-md">
        <ToolbarButton label="加粗" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="斜体" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="删除线" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolbarButton>
        <span className="mx-0.5 h-5 w-px bg-[#E5E7EB]" />
        <ToolbarButton label="二级标题" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="无序列表" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="引用" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolbarButton>
      </div>
    </BubbleMenu>
  );

  if (documentMode) {
    return (
      <div className="bg-white">
        <div className="sticky top-0 z-10 -mx-1 bg-white/95 backdrop-blur">
          <Toolbar editor={editor} onUploadImage={onUploadImage} />
        </div>
        {bubble}
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white">
      <Toolbar editor={editor} onUploadImage={onUploadImage} />
      {bubble}
      <EditorContent editor={editor} />
    </div>
  );
}

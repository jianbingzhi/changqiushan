"use client";

import { useId, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold, Italic, Strikethrough, Heading2, Heading3,
  List, ListOrdered, Quote, Link2, ImageIcon, Undo2, Redo2,
} from "lucide-react";
import { cn } from "@/lib/ui/utils";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

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

function Toolbar({ editor }: { editor: Editor }) {
  // a11y:用内联受控输入替代原生弹窗(读屏不可达、不可键盘取消)
  const [field, setField] = useState<null | "link" | "image">(null);
  const [url, setUrl] = useState("");
  const urlInputId = useId(); // 同页多实例时 label/input 关联不撞 id

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
        <ToolbarButton label="插入图片(URL)" active={field === "image"} onClick={openImage}><ImageIcon className="h-4 w-4" /></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-[#E5E7EB]" />
        <ToolbarButton label="撤销" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="重做" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></ToolbarButton>
      </div>

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

export function RichTextEditor({ value, onChange, placeholder }: Props) {
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
        class: "richtext-content min-h-[220px] px-4 py-3 focus:outline-none",
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
  });

  if (!editor) {
    return <div className="min-h-[260px] rounded-lg border border-[#E5E7EB] bg-white" aria-busy="true" />;
  }

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

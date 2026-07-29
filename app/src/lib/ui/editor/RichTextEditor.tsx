"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useEditor, EditorContent, Node, mergeAttributes, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold, Italic, Strikethrough, Heading2, Heading3,
  List, ListOrdered, Quote, Link2, ImageIcon, ImageUp, Loader2, Undo2, Redo2, Video,
} from "lucide-react";
import { cn } from "@/lib/ui/utils";

// 图片直传由调用方(app 层)注入,保持本组件在 lib 层不依赖 app 的 server action(架构边界)。
export type UploadImage = (file: File) => Promise<{ ok: boolean; url?: string; message: string }>;
// 视频直传与图片完全同构:成功返回 ok+url(公网地址),失败返回 ok=false+中文 message。
export type UploadVideo = UploadImage;

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onUploadImage?: UploadImage;
  // 仅在注入时工具栏才渲染视频按钮;不提供「填地址」退路(视频必须走自家直传链路)
  onUploadVideo?: UploadVideo;
  // "document" = Word 式文档画布:无外框、工具栏吸顶、正文区更高
  variant?: "default" | "document";
}

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const VIDEO_ACCEPT = "video/mp4";

// 拖入/粘贴兜底提示:与文件选择器 accept 口径一致(b-103 评审 #3)
function unsupportedFilesHint(files: File[]): string {
  return files.some((f) => f.type.startsWith("video/"))
    ? "仅支持 H.264 编码的 mp4 视频"
    : "仅支持图片(JPG/PNG/WebP/GIF)或 mp4 视频";
}

// 自定义视频节点:块级 atom,渲染原生 <video controls>(contenteditable 内可直接播放)。
// atom 自带选中态,选中后退格即可删除,无需 NodeView/额外按键处理;
// 官方 youtube 扩展是 iframe 嵌入,不适用自家桶直传的 mp4,故自定义(零新依赖)。
// 服务端 sanitize 已放行 video[src,poster,controls,preload] 且 src 收口自家桶。
const VideoNode = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    // 默认 attribute 解析即 element.getAttribute("src"/"poster"),无需自定义取值
    return {
      src: { default: null },
      poster: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "video[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: "controls",
        preload: "metadata",
        class: "max-w-full rounded-lg",
      }),
    ];
  },
});

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
        "flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-40",
        active && "bg-primary/10 text-primary-strong",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({
  editor, onUploadImage, onUploadVideo,
}: {
  editor: Editor;
  onUploadImage?: UploadImage;
  onUploadVideo?: UploadVideo;
}) {
  // a11y:用内联受控输入替代原生弹窗(读屏不可达、不可键盘取消)
  const [field, setField] = useState<null | "link" | "image">(null);
  const [url, setUrl] = useState("");
  // 上传中状态按类型拆开:图片上传中不锁视频按钮,视频上传中不锁图片按钮
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const urlInputId = useId(); // 同页多实例时 label/input 关联不撞 id

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadImage) return;
    setUploadErr(null);
    setUploadingImage(true);
    try {
      const res = await onUploadImage(file);
      if (res.ok && res.url) editor.chain().focus().setImage({ src: res.url }).run();
      else setUploadErr(res.message);
    } finally {
      setUploadingImage(false);
    }
  }

  async function onPickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadVideo) return;
    setUploadErr(null);
    setUploadingVideo(true);
    try {
      const res = await onUploadVideo(file);
      if (res.ok && res.url) editor.chain().focus().insertContent({ type: "video", attrs: { src: res.url } }).run();
      else setUploadErr(res.message);
    } finally {
      setUploadingVideo(false);
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
      {onUploadVideo && (
        <input ref={videoFileRef} type="file" accept={VIDEO_ACCEPT} className="hidden" onChange={onPickVideo} />
      )}
      {/* round-01 N02(=B36):工具栏/激活态/错误条一律走语义 token,写死浅色 hex 在深色主题下是整条白带 */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted px-2 py-1.5" role="toolbar" aria-label="富文本格式工具栏">
        <ToolbarButton label="加粗" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="斜体" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="删除线" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton label="二级标题" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="三级标题" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="无序列表" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="有序列表" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="引用" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton label="插入链接" active={editor.isActive("link") || field === "link"} onClick={openLink}><Link2 className="h-4 w-4" /></ToolbarButton>
        {/* 图片按钮:有上传能力则直接打开文件选择上传;否则退回填图片地址 */}
        <ToolbarButton
          label={onUploadImage ? "上传图片" : "插入图片(图片地址)"}
          disabled={uploadingImage}
          active={field === "image"}
          onClick={onUploadImage ? () => fileRef.current?.click() : openImage}
        >
          {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : onUploadImage ? <ImageUp className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
        </ToolbarButton>
        {/* 视频按钮:仅注入 onUploadVideo 时渲染,无「填地址」退路;气泡栏不加(块级媒体非选中文字语境) */}
        {onUploadVideo && (
          <ToolbarButton
            label="上传视频(mp4)"
            disabled={uploadingVideo}
            onClick={() => videoFileRef.current?.click()}
          >
            {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
          </ToolbarButton>
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton label="撤销" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="重做" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></ToolbarButton>
        {uploadingImage && <span className="ml-1 text-[12px] text-muted-foreground">图片上传中…</span>}
        {uploadingVideo && <span className="ml-1 text-[12px] text-muted-foreground">视频上传中,大文件请耐心等候…</span>}
      </div>

      {uploadErr && <p className="border-b border-border bg-danger/10 px-3 py-1.5 text-[12px] text-danger-strong">{uploadErr}</p>}

      {field && (
        <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
          <label htmlFor={urlInputId} className="shrink-0 text-[12px] text-muted-foreground">
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
            className="h-8 flex-1 rounded-md border border-border px-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button type="button" onClick={submit} className="shrink-0 rounded-md bg-primary px-3 py-1 text-[12px] text-white">
            {field === "link" ? "应用" : "插入"}
          </button>
          <button type="button" onClick={close} className="shrink-0 rounded-md border border-border px-3 py-1 text-[12px] text-muted-foreground">取消</button>
        </div>
      )}
    </>
  );
}

export function RichTextEditor({ value, onChange, placeholder, onUploadImage, onUploadVideo, variant = "default" }: Props) {
  const documentMode = variant === "document";
  // 拖入/粘贴的 handler 在 useEditor 初始化时固化,用 ref 取最新的上传函数。
  const uploadRef = useRef<UploadImage | undefined>(onUploadImage);
  useEffect(() => { uploadRef.current = onUploadImage; }, [onUploadImage]);
  const uploadVideoRef = useRef<UploadVideo | undefined>(onUploadVideo);
  useEffect(() => { uploadVideoRef.current = onUploadVideo; }, [onUploadVideo]);
  // 拖入/粘贴不支持的文件类型时的提示(b-103 评审 #3);setState 标识稳定,可被固化的 handler 闭包持有
  const [mediaDropErr, setMediaDropErr] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false, // Next SSR 安全:避免水合不一致
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, HTMLAttributes: { class: "text-primary-strong underline" } },
      }),
      Image.configure({ HTMLAttributes: { class: "max-w-full rounded-lg" } }),
      VideoNode,
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
      // 粘贴图片/视频(mp4)→ 按类型双分发,直传后在光标处插入
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        const img = files.find((f) => f.type.startsWith("image/"));
        if (img && uploadRef.current) {
          event.preventDefault();
          void uploadRef.current(img).then((res) => {
            if (res.ok && res.url) {
              const node = view.state.schema.nodes.image.create({ src: res.url });
              view.dispatch(view.state.tr.replaceSelectionWith(node));
            }
          });
          return true;
        }
        const vid = files.find((f) => f.type === "video/mp4");
        if (vid && uploadVideoRef.current) {
          event.preventDefault();
          void uploadVideoRef.current(vid).then((res) => {
            if (res.ok && res.url) {
              const node = view.state.schema.nodes.video.create({ src: res.url });
              view.dispatch(view.state.tr.replaceSelectionWith(node));
            }
          });
          return true;
        }
        // 兜底:粘贴了不支持的文件类型 → 拦下并提示,不让 PM 按文本路径产出脏内容
        if (files.length > 0) {
          event.preventDefault();
          setMediaDropErr(unsupportedFilesHint(files));
          return true;
        }
        return false;
      },
      // 拖入图片/视频(mp4)→ 按类型双分发,直传后在落点处插入
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        const img = files.find((f) => f.type.startsWith("image/"));
        const vid = files.find((f) => f.type === "video/mp4");
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        if (img && uploadRef.current) {
          event.preventDefault();
          void uploadRef.current(img).then((res) => {
            if (res.ok && res.url) {
              const node = view.state.schema.nodes.image.create({ src: res.url });
              view.dispatch(view.state.tr.insert(at ?? view.state.selection.from, node));
            }
          });
          return true;
        }
        if (vid && uploadVideoRef.current) {
          event.preventDefault();
          void uploadVideoRef.current(vid).then((res) => {
            if (res.ok && res.url) {
              const node = view.state.schema.nodes.video.create({ src: res.url });
              view.dispatch(view.state.tr.insert(at ?? view.state.selection.from, node));
            }
          });
          return true;
        }
        // 兜底(b-103 评审 #3):编辑器内任何文件拖放都不放给浏览器默认行为——
        // ProseMirror 已拦 dragover 使编辑区成为合法 drop 目标,此处若返回 false 且未
        // preventDefault,Chrome 会把当前页导航成本地文件,未保存正文全丢。
        if (files.length > 0) {
          event.preventDefault();
          setMediaDropErr(unsupportedFilesHint(files));
          return true;
        }
        return false;
      },
    },
  });

  if (!editor) {
    return <div className="min-h-[260px] rounded-lg border border-border bg-card" aria-busy="true" />;
  }

  // 选中文字浮现的气泡工具栏(Word/Notion 手感):仅常用格式,避免与主工具栏重复过多。
  const bubble = (
    <BubbleMenu editor={editor} options={{ placement: "top" }}>
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-md">
        <ToolbarButton label="加粗" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="斜体" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="删除线" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolbarButton>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <ToolbarButton label="二级标题" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="无序列表" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="引用" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolbarButton>
      </div>
    </BubbleMenu>
  );

  const dropErrBar = mediaDropErr ? (
    <div role="alert" className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] text-danger-strong">
      <span>{mediaDropErr}</span>
      <button type="button" onClick={() => setMediaDropErr(null)} className="shrink-0 text-muted-foreground hover:text-foreground">知道了</button>
    </div>
  ) : null;

  if (documentMode) {
    return (
      <div className="bg-card">
        <div className="sticky top-0 z-10 -mx-1 bg-card/95 backdrop-blur">
          <Toolbar editor={editor} onUploadImage={onUploadImage} onUploadVideo={onUploadVideo} />
          {dropErrBar}
        </div>
        {bubble}
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Toolbar editor={editor} onUploadImage={onUploadImage} onUploadVideo={onUploadVideo} />
      {dropErrBar}
      {bubble}
      <EditorContent editor={editor} />
    </div>
  );
}

import sanitizeHtml from "sanitize-html";

// 正文白名单(R-mp 护栏)单一来源:对齐小程序当前渲染器 mp-html 的可渲染标签子集。
// T2b:渲染端已切 mp-html(支持 video/可点链接),白名单同步放行 video;
// script/iframe/style/任意 class 仍拒。编辑器能力与此保持一致。
export const RICHTEXT_ALLOWED_TAGS = [
  "p", "br", "strong", "em", "s", "del",
  "h2", "h3", "ul", "ol", "li", "blockquote",
  "a", "img", "video",
] as const;

// video.src/poster 域名收口:仅放行自家公共桶基址前缀,外链一律剥除——
// 防带宽盗用与内容失控(img 历史未收口属存量口径,增量从严合理)。
// 口径与 infrastructure/storage publicUrl() 一致;此处直读 env 不引 infrastructure,
// 保持 domain 纯函数可单测(storage 模块带 server-only 标记)。
function ownMediaPrefix(): string {
  const base =
    process.env.S3_PUBLIC_BASE_URL ||
    `${(process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT ?? "http://localhost:9000").replace(/\/$/, "")}/${process.env.S3_BUCKET ?? "changqiushan-media"}`;
  return `${base.replace(/\/$/, "")}/`;
}

const isOwnMedia = (url: string | undefined): url is string =>
  Boolean(url && url.startsWith(ownMediaPrefix()));

// 服务端消毒:存盘前过白名单,清掉 script/iframe/style/onclick/越界 class 等。
// sanitize-html 仅 Node 端可跑;必须在每个写入口(create/update)强制调用,客户端编辑器输出不可信。
export function sanitizeRichText(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: [...RICHTEXT_ALLOWED_TAGS],
    allowedAttributes: {
      a: ["href"],
      img: ["src", "alt"],
      // 不放 autoplay、不放 <source> 子标签;controls 经 transformTags 强制带上
      video: ["src", "poster", "controls", "preload"],
    },
    // 链接/图片只允许 http(s);杜绝 javascript:/data: 等危险协议
    allowedSchemes: ["http", "https"],
    allowedSchemesByTag: { a: ["http", "https"], img: ["http", "https"], video: ["http", "https"] },
    // 关闭隐式 a 协议放行,禁相对协议
    allowProtocolRelative: false,
    // 不保留任何注释/样式
    allowVulnerableTags: false,
    transformTags: {
      // 规范化 video:强制 controls + 元数据预载;poster 非自家桶则剥除(src 收口在 exclusiveFilter)
      video: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...(attribs.src ? { src: attribs.src } : {}),
          ...(isOwnMedia(attribs.poster) ? { poster: attribs.poster } : {}),
          controls: "controls",
          preload: "metadata",
        },
      }),
    },
    // src 缺失或非自家公共桶 → 整个 video 节点剥除
    exclusiveFilter: (frame) =>
      frame.tag === "video" && !isOwnMedia(frame.attribs["src"]),
  });
}

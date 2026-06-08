import sanitizeHtml from "sanitize-html";

// 正文白名单(R-mp 护栏)单一来源:对齐小程序当前渲染器 Taro <rich-text> 的可渲染标签子集。
// 渲染器不支持 video/iframe/script/style/任意 class;<a> 渲染但不可点跳。编辑器能力与此保持一致。
export const RICHTEXT_ALLOWED_TAGS = [
  "p", "br", "strong", "em", "s", "del",
  "h2", "h3", "ul", "ol", "li", "blockquote",
  "a", "img",
] as const;

// 服务端消毒:存盘前过白名单,清掉 script/iframe/style/onclick/越界 class 等。
// sanitize-html 仅 Node 端可跑;必须在每个写入口(create/update)强制调用,客户端编辑器输出不可信。
export function sanitizeRichText(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: [...RICHTEXT_ALLOWED_TAGS],
    allowedAttributes: {
      a: ["href"],
      img: ["src", "alt"],
    },
    // 链接/图片只允许 http(s);杜绝 javascript:/data: 等危险协议
    allowedSchemes: ["http", "https"],
    allowedSchemesByTag: { a: ["http", "https"], img: ["http", "https"] },
    // 关闭隐式 a 协议放行,禁相对协议
    allowProtocolRelative: false,
    // 不保留任何注释/样式
    allowVulnerableTags: false,
  });
}

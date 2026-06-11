import { beforeAll, describe, expect, it } from "vitest";
import { sanitizeRichText, findRejectedVideoSrcs } from "./sanitize";

// T2b 视频闸门:仅放行自家公共桶前缀的 mp4,外链/危险标签全剥。
const BASE = "https://media.example.com";

beforeAll(() => {
  process.env.S3_PUBLIC_BASE_URL = BASE;
});

describe("sanitizeRichText · video 闸门(T2b)", () => {
  it("放行自家桶视频,强制 controls + preload=metadata", () => {
    const out = sanitizeRichText(`<video src="${BASE}/public/assets/a.mp4"></video>`);
    expect(out).toContain(`src="${BASE}/public/assets/a.mp4"`);
    expect(out).toContain("controls");
    expect(out).toContain('preload="metadata"');
  });

  it("剥除 autoplay 等未白名单属性", () => {
    const out = sanitizeRichText(`<video src="${BASE}/v.mp4" autoplay loop muted></video>`);
    expect(out).not.toContain("autoplay");
    expect(out).not.toContain("loop");
  });

  it("外链 src 整节点剥除(带宽盗用/内容失控载体)", () => {
    const out = sanitizeRichText(`<p>前</p><video src="https://evil.example.org/x.mp4"></video><p>后</p>`);
    expect(out).not.toContain("video");
    expect(out).toContain("<p>前</p>");
    expect(out).toContain("<p>后</p>");
  });

  it("无 src 的 video 剥除;<source> 子标签不放行", () => {
    const out = sanitizeRichText(`<video><source src="${BASE}/v.mp4"></video>`);
    expect(out).not.toContain("video");
    expect(out).not.toContain("source");
  });

  it("poster 外链剥除、自家桶保留", () => {
    const ext = sanitizeRichText(`<video src="${BASE}/v.mp4" poster="https://evil.example.org/p.jpg"></video>`);
    expect(ext).not.toContain("evil.example.org");
    const own = sanitizeRichText(`<video src="${BASE}/v.mp4" poster="${BASE}/p.jpg"></video>`);
    expect(own).toContain(`poster="${BASE}/p.jpg"`);
  });

  it("既有白名单行为不回退:script/iframe 剥、img/a 保留", () => {
    const out = sanitizeRichText(
      `<script>alert(1)</script><iframe src="https://x.example.com"></iframe><p><a href="https://x.example.com">链</a><img src="https://x.example.com/i.png" alt="图"></p>`,
    );
    expect(out).not.toContain("script");
    expect(out).not.toContain("iframe");
    expect(out).toContain("<a href=");
    expect(out).toContain("<img src=");
  });

  // b-103 评审 #2:前缀注入(权威来源 publicUrl)优先于 env 兜底推导
  it("mediaPrefix 注入优先于 env:换前缀后旧前缀视频被判拒", () => {
    const NEW = "https://cdn.example.net/bucket";
    const html = `<video src="${BASE}/v.mp4"></video>`;
    expect(sanitizeRichText(html, { mediaPrefix: NEW })).not.toContain("video");
    expect(sanitizeRichText(`<video src="${NEW}/v.mp4"></video>`, { mediaPrefix: NEW })).toContain("video");
  });

  it("findRejectedVideoSrcs:列出会被剥除的视频 src,合法视频不误报", () => {
    const html = `<video src="${BASE}/ok.mp4"></video><video src="https://evil.example.org/x.mp4"></video><video></video>`;
    expect(findRejectedVideoSrcs(html)).toEqual(["https://evil.example.org/x.mp4", ""]);
    expect(findRejectedVideoSrcs(`<video src="${BASE}/ok.mp4"></video>`)).toEqual([]);
  });
});

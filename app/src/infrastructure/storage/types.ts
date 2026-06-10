// BE-B 媒体存储:上传校验口径 + 类型。服务端权威校验(白名单 contentType、大小上限、
// 服务端派生 key 防路径注入),前端给的 filename 仅用于展示,绝不进 key。

export const IMAGE_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

export type ImageContentType = keyof typeof IMAGE_CONTENT_TYPES;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

// T2c 视频:只收 mp4(H.264)——无 ffmpeg 转码基建,mp4/H.264 是全平台(微信小程序/浏览器)唯一安全格式,属产品约定。
export const VIDEO_CONTENT_TYPES = {
  "video/mp4": "mp4",
} as const;

export type VideoContentType = keyof typeof VIDEO_CONTENT_TYPES;

export type UploadKind = "image" | "video";

// 视频上限 env 配置化:缺省 100MB;Supabase 免费档单文件 50MB(Vercel 环境应设 50MB 相应值)。
export function maxVideoUploadBytes(): number {
  const v = Number(process.env.MAX_VIDEO_UPLOAD_BYTES);
  return Number.isFinite(v) && v > 0 ? v : 100 * 1024 * 1024;
}

export function isAllowedImageType(ct: string): ct is ImageContentType {
  return ct in IMAGE_CONTENT_TYPES;
}

export function isAllowedVideoType(ct: string): ct is VideoContentType {
  return ct in VIDEO_CONTENT_TYPES;
}

export function extForContentType(ct: ImageContentType): string {
  return IMAGE_CONTENT_TYPES[ct];
}

export function extForVideoType(ct: VideoContentType): string {
  return VIDEO_CONTENT_TYPES[ct];
}

export type PresignResult = { uploadUrl: string; key: string };

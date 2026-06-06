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

export function isAllowedImageType(ct: string): ct is ImageContentType {
  return ct in IMAGE_CONTENT_TYPES;
}

export function extForContentType(ct: ImageContentType): string {
  return IMAGE_CONTENT_TYPES[ct];
}

export type PresignResult = { uploadUrl: string; key: string };

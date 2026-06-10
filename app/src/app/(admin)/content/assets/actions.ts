"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireRole, ADMIN_UP } from "@/infrastructure/auth/guard";
import { assetService } from "@/modules/content";
import {
  getSignedUploadUrl,
  moveObject,
  deleteObject,
  publicUrl,
  isAllowedImageType,
  isAllowedVideoType,
  extForContentType,
  extForVideoType,
  MAX_UPLOAD_BYTES,
  maxVideoUploadBytes,
  type UploadKind,
} from "@/infrastructure/storage";

export type AssetActionResult = { ok: boolean; message: string; url?: string };
export type AssetPickRow = {
  id: string;
  name: string;
  url: string;
  size: number;
  createdAt: string;
};
export type PresignActionResult =
  | { ok: true; uploadUrl: string; key: string }
  | { ok: false; message: string };

const STAGING_PREFIX = "staging/";

// T2c kind 分叉:image 走既有白名单/10MB;video 只收 mp4(H.264)、上限 env 化(缺省 100MB)。
// 校验通过返回 null,否则返回中文错误信息;ext 由服务端按 contentType 派生。
function validateUpload(kind: UploadKind, contentType: string, size: number): { error: string } | { ext: string } {
  if (kind === "video") {
    if (!isAllowedVideoType(contentType)) {
      return { error: "仅支持 MP4(H.264 编码)视频" };
    }
    const max = maxVideoUploadBytes();
    if (!Number.isFinite(size) || size <= 0 || size > max) {
      return { error: `视频大小须在 ${Math.floor(max / 1024 / 1024)}MB 以内` };
    }
    return { ext: extForVideoType(contentType) };
  }
  if (!isAllowedImageType(contentType)) {
    return { error: "仅支持 JPG / PNG / WebP / GIF 图片" };
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    return { error: "图片大小须在 10MB 以内" };
  }
  return { ext: extForContentType(contentType) };
}

// 预签名直传:服务端权威校验白名单/大小,key 由服务端派生(防路径注入),返回直传 URL。
export async function presignUploadAction(input: {
  contentType: string;
  size: number;
  kind?: UploadKind;
}): Promise<PresignActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const checked = validateUpload(input.kind ?? "image", input.contentType, input.size);
  if ("error" in checked) return { ok: false, message: checked.error };

  const key = `${STAGING_PREFIX}${randomUUID()}.${checked.ext}`;
  try {
    const { uploadUrl } = await getSignedUploadUrl(key, input.contentType, {
      contentLength: input.size,
    });
    return { ok: true, uploadUrl, key };
  } catch {
    return { ok: false, message: "存储服务暂不可用,请稍后重试" };
  }
}

// 提交:把 staging 对象移到 public 前缀(避免孤儿公开文件),写归档记录,返回公网 URL。
export async function commitAssetAction(input: {
  stagingKey: string;
  name: string;
  contentType: string;
  size: number;
  activityId?: string;
  kind?: UploadKind;
}): Promise<AssetActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const kind = input.kind ?? "image";
  const checked = validateUpload(kind, input.contentType, input.size);
  if ("error" in checked) return { ok: false, message: checked.error };

  // 防路径穿越:stagingKey 后缀必须是 presign 派生的 <uuid>.<ext> 形态,杜绝 "../" 改写任意 key;
  // 且后缀须与本次 kind 派生的扩展名一致(防 image 凭据提交 mp4 之类的串用)。
  if (!input.stagingKey.startsWith(STAGING_PREFIX)) {
    return { ok: false, message: "上传凭据无效" };
  }
  const suffix = input.stagingKey.slice(STAGING_PREFIX.length);
  if (!/^[\w-]+\.(jpg|png|webp|gif|mp4)$/i.test(suffix) || !suffix.toLowerCase().endsWith(`.${checked.ext}`)) {
    return { ok: false, message: "上传凭据无效" };
  }

  const finalKey = `public/assets/${suffix}`;
  try {
    await moveObject(input.stagingKey, finalKey);
  } catch {
    return { ok: false, message: "素材转存失败,请重试" };
  }

  const res = await assetService.archiveAsset({
    activityId: input.activityId ?? null,
    name: input.name,
    key: finalKey,
    url: publicUrl(finalKey),
    type: input.contentType,
    size: input.size,
    createdBy: auth.session.userId,
  });
  if (!res.ok) {
    // 归档失败 → 回收已转存对象,避免孤儿。
    await deleteObject(finalKey).catch(() => {});
    return { ok: false, message: res.message };
  }

  revalidatePath("/content/assets");
  return { ok: true, message: `已上传素材「${res.value.name}」`, url: res.value.url };
}

// 封面/编辑器的「从素材库选择」用:返回已归档图片素材(轻量行)。
export async function listAssetsAction(): Promise<AssetPickRow[]> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return [];
  const assets = await assetService.listAssets().catch(() => []);
  return assets.map((a) => ({
    id: a.id,
    name: a.name,
    url: a.url,
    size: a.size,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function deleteAssetAction(id: string): Promise<AssetActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  const res = await assetService.removeAsset(id);
  if (!res.ok) return { ok: false, message: res.message };

  // 删除归档记录后清理对象存储(失败不阻断:记录已删,对象可由生命周期清理)。
  await deleteObject(res.value.key).catch(() => {});
  revalidatePath("/content/assets");
  return { ok: true, message: "已删除素材" };
}

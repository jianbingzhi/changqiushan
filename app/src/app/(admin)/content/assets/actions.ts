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
  extForContentType,
  MAX_UPLOAD_BYTES,
} from "@/infrastructure/storage";

export type AssetActionResult = { ok: boolean; message: string };
export type PresignActionResult =
  | { ok: true; uploadUrl: string; key: string }
  | { ok: false; message: string };

const STAGING_PREFIX = "staging/";

// 预签名直传:服务端权威校验白名单/大小,key 由服务端派生(防路径注入),返回直传 URL。
export async function presignUploadAction(input: {
  contentType: string;
  size: number;
}): Promise<PresignActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  if (!isAllowedImageType(input.contentType)) {
    return { ok: false, message: "仅支持 JPG / PNG / WebP / GIF 图片" };
  }
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "图片大小须在 10MB 以内" };
  }

  const key = `${STAGING_PREFIX}${randomUUID()}.${extForContentType(input.contentType)}`;
  try {
    const { uploadUrl } = await getSignedUploadUrl(key, input.contentType);
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
}): Promise<AssetActionResult> {
  const auth = await requireRole(ADMIN_UP);
  if (!auth.ok) return { ok: false, message: auth.message };

  if (!input.stagingKey.startsWith(STAGING_PREFIX)) {
    return { ok: false, message: "上传凭据无效" };
  }
  if (!isAllowedImageType(input.contentType)) {
    return { ok: false, message: "图片类型不合法" };
  }

  const finalKey = `public/assets/${input.stagingKey.slice(STAGING_PREFIX.length)}`;
  try {
    await moveObject(input.stagingKey, finalKey);
  } catch {
    return { ok: false, message: "图片转存失败,请重试" };
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
  return { ok: true, message: `已上传素材「${res.value.name}」` };
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

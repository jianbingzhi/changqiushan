"use client";

import { useCallback, useState } from "react";
import { presignUploadAction, commitAssetAction } from "./assets/actions";

export type UploadResult = { ok: boolean; url?: string; message: string };

// 图片直传共用逻辑:预签名 → 浏览器 PUT 直传对象存储 → commit 转正落库,回传公网 URL。
// 素材库 / 封面字段 / 编辑器插图共用同一套,避免多份直传代码漂移。
export function useImageUpload() {
  const [busy, setBusy] = useState(false);

  const uploadImage = useCallback(async (file: File): Promise<UploadResult> => {
    setBusy(true);
    try {
      // 1) 取预签名(服务端权威校验类型/大小 + 派生 key)
      const presign = await presignUploadAction({ contentType: file.type, size: file.size });
      if (!presign.ok) return { ok: false, message: presign.message };

      // 2) 浏览器直传(不经服务端,省内存/时长)
      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) return { ok: false, message: "直传失败,请检查存储服务可达性" };

      // 3) 提交:转存 public + 归档,回传公网 URL
      const commit = await commitAssetAction({
        stagingKey: presign.key,
        name: file.name,
        contentType: file.type,
        size: file.size,
      });
      return { ok: commit.ok, url: commit.url, message: commit.message };
    } catch {
      return { ok: false, message: "上传出错,请重试" };
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, uploadImage };
}

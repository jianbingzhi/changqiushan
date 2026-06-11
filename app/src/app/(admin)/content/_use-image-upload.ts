"use client";

import { useCallback, useState } from "react";
import type { UploadKind } from "@/infrastructure/storage";
import { presignUploadAction, commitAssetAction } from "./assets/actions";

export type UploadResult = { ok: boolean; url?: string; message: string };

// 体积上限不在客户端复制一份:权威校验是服务端 maxVideoUploadBytes(env 可配,Vercel 50MB/
// 缺省 100MB),且校验发生在 presign 阶段、PUT 之前——超限不会白传一个字节,客户端双写
// 只会在 env 改值后与服务端文案打架(b-103 评审 #6)。

// 图片/视频直传共用逻辑:预签名 → 浏览器 PUT 直传对象存储 → commit 转正落库,回传公网 URL。
// 素材库 / 封面字段 / 编辑器插图、插视频共用同一套,避免多份直传代码漂移。
export function useImageUpload() {
  const [busy, setBusy] = useState(false);

  const upload = useCallback(async (file: File, kind: UploadKind): Promise<UploadResult> => {
    setBusy(true);
    try {
      // 1) 取预签名(服务端权威校验类型/大小 + 派生 key)
      const presign = await presignUploadAction({ contentType: file.type, size: file.size, kind });
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
        kind,
      });
      return { ok: commit.ok, url: commit.url, message: commit.message };
    } catch {
      return { ok: false, message: "上传出错,请重试" };
    } finally {
      setBusy(false);
    }
  }, []);

  const uploadImage = useCallback((file: File) => upload(file, "image"), [upload]);

  // 类型零成本预检;体积交给 presign 的服务端权威校验(错误信息自带当前上限值)。
  const uploadVideo = useCallback(async (file: File): Promise<UploadResult> => {
    if (file.type !== "video/mp4") {
      return { ok: false, message: "仅支持 H.264 编码 mp4 视频(建议 1080p)" };
    }
    return upload(file, "video");
  }, [upload]);

  return { busy, uploadImage, uploadVideo };
}

import { Prisma } from "@prisma/client";
import type { ContentAsset } from "@prisma/client";
import { contentRepository } from "../repository";
import { ok, err, ErrCode, type Result } from "@/shared/result";

// R-素材 媒体素材库服务(DB-only)。对象存储 presign/move/delete 由 app 路由层组合调用
// infrastructure/storage,本服务只管归档记录,守模块职责单一。
export const assetService = {
  listAssets(activityId?: string): Promise<ContentAsset[]> {
    return contentRepository.listAssets(activityId);
  },

  getAsset(id: string) {
    return contentRepository.getAsset(id);
  },

  async archiveAsset(input: {
    activityId?: string | null;
    name: string;
    key: string;
    url: string;
    type: string;
    size: number;
    createdBy?: string | null;
  }): Promise<Result<ContentAsset>> {
    if (!input.name?.trim()) return err(ErrCode.INVALID_INPUT, "素材名不能为空");
    if (!input.key || !input.url) return err(ErrCode.INVALID_INPUT, "素材存储信息缺失");
    try {
      const asset = await contentRepository.createAsset({
        activityId: input.activityId ?? null,
        name: input.name.trim().slice(0, 120),
        key: input.key,
        url: input.url,
        type: input.type,
        size: input.size,
        createdBy: input.createdBy ?? null,
      });
      return ok(asset);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return err(ErrCode.CONFLICT, "该素材已归档");
      }
      throw e;
    }
  },

  // 删除归档记录,返回 key 供调用方一并清理对象存储。
  async removeAsset(id: string): Promise<Result<{ key: string }>> {
    const asset = await contentRepository.getAsset(id);
    if (!asset) return err(ErrCode.NOT_FOUND, "素材不存在");
    await contentRepository.deleteAsset(id);
    return ok({ key: asset.key });
  },
};

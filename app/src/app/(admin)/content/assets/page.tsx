import { PageHeader } from "@/lib/ui/page-header";
import { assetService } from "@/modules/content";
import { AssetLibrary, type AssetRow } from "./_asset-library";

export const dynamic = "force-dynamic";
export const metadata = { title: "媒体素材库 · 长秋山管理后台" };

export default async function AssetsPage() {
  const assets = await assetService.listAssets().catch(() => []);

  const rows: AssetRow[] = assets.map((a) => ({
    id: a.id,
    name: a.name,
    url: a.url,
    type: a.type,
    size: a.size,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="媒体素材库"
        description="上传活动/资讯封面等图片素材;预签名直传对象存储,封面选择器可引用"
      />
      <AssetLibrary assets={rows} />
    </>
  );
}

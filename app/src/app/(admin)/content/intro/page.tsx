import Link from "next/link";
import { contentRepository } from "@/modules/content";
import { PageHeader } from "@/lib/ui/page-header";
import { Button } from "@/lib/ui/button";
import { EmptyState } from "@/lib/ui/empty-state";
import { formatCnDate } from "@/shared/format";
import { SortableContentRows } from "../_sortable-rows";

export const dynamic = "force-dynamic";
export const metadata = { title: "景区介绍维护 · 长秋山管理后台" };

export default async function ContentIntroPage() {
  const items = await contentRepository.listIntros();

  return (
    <>
      <PageHeader title="景区介绍维护" description="管理景区文字/图片介绍内容;拖动左侧手柄可调整展示顺序"
        actions={<Link href="/content/intro/new"><Button>新建介绍</Button></Link>}
      />
      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card"><EmptyState message="暂无景区介绍内容" /></div>
      ) : (
        <SortableContentRows
          model="intro"
          listPath="/content/intro"
          editBase="/content/intro"
          items={items.map((i) => ({
            id: i.id,
            title: i.title,
            status: i.status,
            publishedAtText: i.publishedAt ? formatCnDate(i.publishedAt) : null,
          }))}
        />
      )}
    </>
  );
}

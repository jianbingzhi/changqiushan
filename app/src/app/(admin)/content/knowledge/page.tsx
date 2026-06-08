import Link from "next/link";
import { contentRepository } from "@/modules/content";
import { PageHeader } from "@/lib/ui/page-header";
import { Button } from "@/lib/ui/button";
import { EmptyState } from "@/lib/ui/empty-state";
import { SortableContentRows } from "../_sortable-rows";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI 问答知识库 · 长秋山管理后台" };

type SearchParams = { q?: string; category?: string };

export default async function ContentKnowledgePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q        = sp.q        ?? "";
  const category = sp.category ?? "";

  const all = await contentRepository.listKnowledge(category || undefined);
  // 关键词在标题/内容中模糊匹配(低基数,运行时过滤即可)
  const kw = q.trim().toLowerCase();
  const items = kw
    ? all.filter((k) => k.title.toLowerCase().includes(kw) || k.content.toLowerCase().includes(kw))
    : all;

  return (
    <>
      <PageHeader title="AI 问答知识库" description="维护景区 AI 问答知识条目"
        actions={<Link href="/content/knowledge/new"><Button>新建条目</Button></Link>}
      />
      <form method="GET" className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-[#6B7280]">关键词搜索</label>
          <input name="q" defaultValue={q} placeholder="搜索问题或关键词"
            className="h-9 w-56 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/30" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-[#6B7280]">分类</label>
          <select name="category" defaultValue={category}
            className="h-9 w-32 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/30">
            {[["", "全部分类"], ["游览", "游览"], ["交通", "交通"], ["设施", "设施"], ["活动", "活动"], ["其他", "其他"]].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="inline-flex h-9 items-center rounded-md bg-[#2D5A27] px-4 text-sm font-medium text-white hover:opacity-90">搜索</button>
        <a href="/content/knowledge" className="inline-flex h-9 items-center rounded-md border border-[#E5E7EB] bg-white px-4 text-sm text-[#6B7280]">清空</a>
      </form>
      {items.length === 0 ? (
        <div className="rounded-lg border border-[#E5E7EB] bg-white"><EmptyState message="暂无知识条目" /></div>
      ) : (
        <>
          {(kw || category) && (
            <p className="mb-2 text-xs text-[#9CA3AF]">筛选结果下不可拖拽排序;清空筛选后可调整顺序。</p>
          )}
          <SortableContentRows
            model="knowledge"
            listPath="/content/knowledge"
            editBase="/content/knowledge"
            sortable={!kw && !category}
            items={items.map((i) => ({
              id: i.id,
              title: i.title,
              status: i.status,
              category: i.category,
            }))}
          />
        </>
      )}
    </>
  );
}

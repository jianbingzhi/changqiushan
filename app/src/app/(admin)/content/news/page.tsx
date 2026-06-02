import { contentRepository } from "@/modules/content";
import { PageHeader } from "@/lib/ui/page-header";
import { Button } from "@/lib/ui/button";
import { StatusChip } from "@/lib/ui/status-chip";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { formatCnDate } from "@/shared/format";
import { StatusToggle } from "../_status-toggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "资讯模块 · 长秋山管理后台" };

export default async function ContentNewsPage() {
  const items = await contentRepository.listNews();

  return (
    <>
      <PageHeader title="资讯模块" description="管理景区公告、新闻、通知"
        actions={<Button className="bg-[#2D5A27] text-white" disabled title="content 模块建立后启用">新建资讯</Button>}
      />
      <div className="rounded-lg border border-[#E5E7EB] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              {["标题", "摘要", "状态", "发布时间", "操作"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="p-0"><EmptyState message="暂无资讯内容" /></TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id} className="hover:bg-[#F9FAFB]">
                <TableCell className="font-medium text-[#1F2937] max-w-[220px] truncate">{item.title}</TableCell>
                <TableCell className="text-[13px] text-[#6B7280] max-w-[300px] truncate">{item.summary ?? "—"}</TableCell>
                <TableCell><StatusChip status={item.status === "PUBLISHED" ? "ACTIVE" : "PAUSED"} /></TableCell>
                <TableCell className="text-[13px] text-[#6B7280]">{item.publishedAt ? formatCnDate(item.publishedAt) : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-[12px]" disabled>编辑</Button>
                    <StatusToggle model="news" id={item.id} status={item.status} revalidate="/content/news" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

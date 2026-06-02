import { contentRepository } from "@/modules/content";
import { PageHeader } from "@/lib/ui/page-header";
import { Button } from "@/lib/ui/button";
import { StatusChip } from "@/lib/ui/status-chip";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { formatCnDate } from "@/shared/format";
import { StatusToggle } from "../_status-toggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "景区介绍维护 · 长秋山管理后台" };

export default async function ContentIntroPage() {
  const items = await contentRepository.listIntros();

  return (
    <>
      <PageHeader title="景区介绍维护" description="管理景区文字/图片介绍内容"
        actions={<Button className="bg-[#2D5A27] text-white" disabled title="content 模块建立后启用">新建介绍</Button>}
      />
      <div className="rounded-lg border border-[#E5E7EB] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              {["标题", "状态", "排序", "发布时间", "操作"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="p-0"><EmptyState message="暂无景区介绍内容" /></TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id} className="hover:bg-[#F9FAFB]">
                <TableCell className="font-medium text-[#1F2937]">{item.title}</TableCell>
                <TableCell><StatusChip status={item.status === "PUBLISHED" ? "ACTIVE" : "PAUSED"} /></TableCell>
                <TableCell className="text-[#6B7280]">{item.sortOrder}</TableCell>
                <TableCell className="text-[13px] text-[#6B7280]">{item.publishedAt ? formatCnDate(item.publishedAt) : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-[12px]" disabled>编辑</Button>
                    <StatusToggle model="intro" id={item.id} status={item.status} revalidate="/content/intro" />
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

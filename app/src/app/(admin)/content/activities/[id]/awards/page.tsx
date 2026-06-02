import { PageHeader } from "@/lib/ui/page-header";
import { Button } from "@/lib/ui/button";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { formatCnDateTime } from "@/shared/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `获奖公示（${id.slice(0, 8).toUpperCase()}） · 长秋山管理后台` };
}

type Props = { params: Promise<{ id: string }> };

export default async function ActivityAwardsPage({ params }: Props) {
  await params;
  // TODO 阶段4: contentRepository.listAwards(id)
  const items: { id: string; winnerName: string; phone: string; awardTitle: string; announcedAt: Date }[] = [];

  function maskPhone(p: string) {
    return p.length === 11 ? `${p.slice(0, 3)}****${p.slice(-4)}` : p;
  }

  return (
    <>
      <PageHeader title="获奖公示" description="公示本次活动获奖名单"
        actions={<Button className="bg-[#2D5A27] text-white" disabled title="content 模块建立后启用">新增获奖</Button>}
      />
      <div className="rounded-lg border border-[#E5E7EB] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              {["获奖者", "手机号", "奖项", "公示时间", "操作"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="p-0"><EmptyState message="暂无获奖公示信息" /></TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id} className="hover:bg-[#F9FAFB]">
                <TableCell className="font-medium text-[#1F2937]">{item.winnerName}</TableCell>
                <TableCell className="font-mono text-[13px] text-[#6B7280]">{maskPhone(item.phone)}</TableCell>
                <TableCell className="text-[13px] text-[#1F2937]">{item.awardTitle}</TableCell>
                <TableCell className="text-[13px] text-[#6B7280]">{formatCnDateTime(item.announcedAt)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" className="text-[12px] text-[#DC2626] border-[#FECACA]" disabled>撤销公示</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

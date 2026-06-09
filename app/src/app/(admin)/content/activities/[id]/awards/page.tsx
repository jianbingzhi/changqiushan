import { contentRepository } from "@/modules/content";
import { PageHeader } from "@/lib/ui/page-header";
import { Button } from "@/lib/ui/button";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { formatCnDateTime } from "@/shared/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = await contentRepository.getActivity(id).catch(() => null);
  return { title: `获奖公示（${activity?.title ?? id.slice(0, 8).toUpperCase()}） · 长秋山管理后台` };
}

type Props = { params: Promise<{ id: string }> };

export default async function ActivityAwardsPage({ params }: Props) {
  const { id } = await params;
  const items = await contentRepository.listAwards(id).catch(() => []);

  function maskPhone(p: string) {
    return p.length === 11 ? `${p.slice(0, 3)}****${p.slice(-4)}` : p;
  }

  return (
    <>
      <PageHeader title="获奖公示" description="公示本次活动获奖名单"
        actions={<Button className="bg-primary text-white" disabled title="内容模块建立后启用">新增获奖</Button>}
      />
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              {["获奖者", "手机号", "奖项", "公示时间", "操作"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="p-0"><EmptyState message="暂无获奖公示信息" /></TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted">
                <TableCell className="font-medium text-foreground">{item.winnerName}</TableCell>
                <TableCell className="font-mono text-[13px] text-muted-foreground">{maskPhone(item.phone)}</TableCell>
                <TableCell className="text-[13px] text-foreground">{item.awardTitle}</TableCell>
                <TableCell className="text-[13px] text-muted-foreground">{formatCnDateTime(item.announcedAt)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" className="text-[12px] text-danger border-[#FECACA]" disabled>撤销公示</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

import { contentRepository } from "@/modules/content";
import { PageHeader } from "@/lib/ui/page-header";
import { StatusChip } from "@/lib/ui/status-chip";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { formatCnDateTime } from "@/shared/format";
import { ReviewButtons } from "./_review-buttons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = await contentRepository.getActivity(id).catch(() => null);
  return { title: `报名审核（${activity?.title ?? id.slice(0, 8).toUpperCase()}） · 长秋山管理后台` };
}

type Props = { params: Promise<{ id: string }> };

export default async function ActivitySignupsPage({ params }: Props) {
  const { id } = await params;
  const [activity, items] = await Promise.all([
    contentRepository.getActivity(id).catch(() => null),
    contentRepository.listSignups(id).catch(() => []),
  ]);

  return (
    <>
      <PageHeader title="报名审核" description={`${activity?.title ?? "活动"} · 查看参与者报名信息及支付状态`} />
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
        <span className="text-[13px] text-info">支付状态由 C 端小程序同步，B 端不触发支付，审核操作仅影响参与资格。</span>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              {["报名人", "手机号", "报名时间", "支付状态", "备注", "操作"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="p-0"><EmptyState message="暂无报名数据" /></TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted">
                <TableCell className="font-medium text-foreground">{item.userName}</TableCell>
                <TableCell className="text-[13px] text-muted-foreground">{item.phone}</TableCell>
                <TableCell className="text-[13px] text-muted-foreground">{formatCnDateTime(item.createdAt)}</TableCell>
                <TableCell>
                  {/* REFUNDED 在 B 端显示为「已撤销」(PRD 禁用"退款"字样) */}
                {item.paymentStatus === "REFUNDED"
                  ? <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border bg-muted text-muted-foreground border-border">已撤销</span>
                  : <StatusChip status={item.paymentStatus === "PAID" ? "CONFIRMED" : "PENDING"} />
                }
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground max-w-[200px] truncate">{item.notes ?? "—"}</TableCell>
                <TableCell>
                  <ReviewButtons activityId={id} signupId={item.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

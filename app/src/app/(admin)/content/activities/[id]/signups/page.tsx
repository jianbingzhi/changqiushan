import { PageHeader } from "@/lib/ui/page-header";
import { Button } from "@/lib/ui/button";
import { StatusChip } from "@/lib/ui/status-chip";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { formatCnDateTime } from "@/shared/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `报名审核（${id.slice(0, 8).toUpperCase()}） · 长秋山管理后台` };
}

type Props = { params: Promise<{ id: string }> };

export default async function ActivitySignupsPage({ params }: Props) {
  await params;
  // TODO 阶段4: contentRepository.getActivity(id) + contentRepository.listSignups(id)
  const items: { id: string; userName: string; phone: string; createdAt: Date; paymentStatus: "PAID" | "UNPAID" | "REFUNDED"; notes: string | null }[] = [];

  return (
    <>
      <PageHeader title="报名审核" description="查看参与者报名信息及支付状态" />
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
        <span className="text-[13px] text-[#2563EB]">支付状态由 C 端小程序同步，B 端不触发支付，审核操作仅影响参与资格。</span>
      </div>
      <div className="rounded-lg border border-[#E5E7EB] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              {["报名人", "手机号", "报名时间", "支付状态", "备注", "操作"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="p-0"><EmptyState message="暂无报名数据（content 模块建立后展示）" /></TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id} className="hover:bg-[#F9FAFB]">
                <TableCell className="font-medium text-[#1F2937]">{item.userName}</TableCell>
                <TableCell className="text-[13px] text-[#6B7280]">{item.phone}</TableCell>
                <TableCell className="text-[13px] text-[#6B7280]">{formatCnDateTime(item.createdAt)}</TableCell>
                <TableCell>
                  <StatusChip status={item.paymentStatus === "PAID" ? "CONFIRMED" : item.paymentStatus === "REFUNDED" ? "CANCELLED" : "PENDING"} />
                </TableCell>
                <TableCell className="text-[13px] text-[#6B7280] max-w-[200px] truncate">{item.notes ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" className="text-[12px] bg-[#2D5A27] text-white" disabled title="content 模块建立后启用">通过</Button>
                    <Button size="sm" variant="outline" className="text-[12px] text-[#DC2626] border-[#FECACA]" disabled title="content 模块建立后启用">驳回</Button>
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

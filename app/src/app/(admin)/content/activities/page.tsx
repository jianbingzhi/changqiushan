import Link from "next/link";
import { PageHeader } from "@/lib/ui/page-header";
import { Button } from "@/lib/ui/button";
import { StatusChip } from "@/lib/ui/status-chip";
import { EmptyState } from "@/lib/ui/empty-state";
import { StatCard, KpiRow } from "@/lib/ui/stat-card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { formatCnDate } from "@/shared/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "活动运营管理 · 长秋山管理后台" };

export default async function ContentActivitiesPage() {
  // TODO 阶段4: contentRepository.listActivities() + countActivities()
  const items: { id: string; title: string; startDate: Date; endDate: Date; registrationFee: number; status: "PUBLISHED" | "DRAFT"; signupsCount: number }[] = [];

  return (
    <>
      <PageHeader title="活动运营管理" description="创建和管理景区活动，报名费由 C 端小程序处理"
        actions={<Button className="bg-[#2D5A27] text-white" disabled title="content 模块建立后启用">新建活动</Button>}
      />
      <div className="mb-6">
        <KpiRow>
          <StatCard label="活动总数" value={0} unit="个" />
          <StatCard label="进行中" value={0} unit="个" />
          <StatCard label="已结束" value={0} unit="个" />
          <StatCard label="本月新增" value={0} unit="个" />
        </KpiRow>
      </div>
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
        <span className="text-[13px] text-[#2563EB]">报名费由 C 端小程序支付，B 端仅查看参与人数与支付状态，不触发任何支付操作。</span>
      </div>
      <div className="rounded-lg border border-[#E5E7EB] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              {["活动名称", "时间", "报名费", "状态", "参与人数", "操作"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="p-0"><EmptyState message="暂无活动数据（content 模块建立后展示）" /></TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id} className="hover:bg-[#F9FAFB]">
                <TableCell className="font-medium text-[#1F2937]">{item.title}</TableCell>
                <TableCell className="text-[13px] text-[#6B7280]">{formatCnDate(item.startDate)} ~ {formatCnDate(item.endDate)}</TableCell>
                <TableCell className="text-[13px]">{item.registrationFee === 0 ? <span className="text-[#6B7280]">免费</span> : `¥${item.registrationFee}`}</TableCell>
                <TableCell><StatusChip status={item.status === "PUBLISHED" ? "ACTIVE" : "PAUSED"} /></TableCell>
                <TableCell className="text-[13px]">{item.signupsCount} 人</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-[12px]" disabled>编辑</Button>
                    <Link href={`/content/activities/${item.id}/signups`}><Button size="sm" variant="outline" className="text-[12px]">报名审核</Button></Link>
                    <Link href={`/content/activities/${item.id}/awards`}><Button size="sm" variant="outline" className="text-[12px]">获奖公示</Button></Link>
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

import Link from "next/link";
import { contentRepository } from "@/modules/content";
import { PageHeader } from "@/lib/ui/page-header";
import { Button } from "@/lib/ui/button";
import { StatusChip } from "@/lib/ui/status-chip";
import { EmptyState } from "@/lib/ui/empty-state";
import { StatCard, KpiRow } from "@/lib/ui/stat-card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { formatCnDate } from "@/shared/format";
import { StatusToggle } from "../_status-toggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "活动运营管理 · 长秋山管理后台" };

export default async function ContentActivitiesPage() {
  const items = await contentRepository.listActivitiesWithCounts();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const ongoing = items.filter((a) => a.status === "PUBLISHED" && a.startDate <= now && a.endDate >= now).length;
  const ended = items.filter((a) => a.endDate < now).length;
  const newThisMonth = items.filter((a) => a.createdAt >= monthStart).length;

  return (
    <>
      <PageHeader title="活动运营管理" description="创建和管理景区活动，报名费由 C 端小程序处理"
        actions={<Link href="/content/activities/new"><Button style={{ backgroundColor: "#2D5A27", color: "#fff" }}>新建活动</Button></Link>}
      />
      <div className="mb-6">
        <KpiRow>
          <StatCard label="活动总数" value={items.length} unit="个" />
          <StatCard label="进行中" value={ongoing} unit="个" />
          <StatCard label="已结束" value={ended} unit="个" />
          <StatCard label="本月新增" value={newThisMonth} unit="个" />
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
              <TableRow><TableCell colSpan={6} className="p-0"><EmptyState message="暂无活动数据" /></TableCell></TableRow>
            ) : items.map((item) => {
              const fee = Number(item.registrationFee);
              return (
              <TableRow key={item.id} className="hover:bg-[#F9FAFB]">
                <TableCell className="font-medium text-[#1F2937]">{item.title}</TableCell>
                <TableCell className="text-[13px] text-[#6B7280]">{formatCnDate(item.startDate)} ~ {formatCnDate(item.endDate)}</TableCell>
                <TableCell className="text-[13px]">{fee === 0 ? <span className="text-[#6B7280]">免费</span> : `¥${fee}`}</TableCell>
                <TableCell><StatusChip status={item.status === "PUBLISHED" ? "ACTIVE" : "PAUSED"} /></TableCell>
                <TableCell className="text-[13px]">{item._count.signups} 人</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link href={`/content/activities/${item.id}/edit`}><Button size="sm" variant="outline" className="text-[12px]">编辑</Button></Link>
                    <StatusToggle model="activity" id={item.id} status={item.status} revalidate="/content/activities" />
                    <Link href={`/content/activities/${item.id}/signups`}><Button size="sm" variant="outline" className="text-[12px]">报名审核</Button></Link>
                    <Link href={`/content/activities/${item.id}/awards`}><Button size="sm" variant="outline" className="text-[12px]">获奖公示</Button></Link>
                  </div>
                </TableCell>
              </TableRow>
            );})}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

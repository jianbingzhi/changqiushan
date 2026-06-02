import Link from "next/link";
import { riskcontrolRepository } from "@/modules/riskcontrol";
import { PageHeader } from "@/lib/ui/page-header";
import { EmptyState } from "@/lib/ui/empty-state";
import { StatusChip } from "@/lib/ui/status-chip";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { formatCnDateTime } from "@/shared/format";
import { RemoveBlacklistButton, ReviewAppealButtons } from "./_action-buttons";

export const dynamic = "force-dynamic";
export const metadata = { title: "爽约风控与黑名单 · 长秋山管理后台" };

function maskIdCard(id: string) {
  return id.length >= 8 ? `${id.slice(0, 4)}****${id.slice(-4)}` : id;
}

type SearchParams = { tab?: string };

export default async function BlacklistPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const activeTab = sp.tab === "appeals" ? "appeals" : "blacklist";

  const [blacklistItems, appealItems] = await Promise.all([
    riskcontrolRepository.findBlacklistAll(),
    riskcontrolRepository.listAppeals(),
  ]);

  return (
    <>
      <PageHeader title="爽约风控与黑名单" description="管理爽约用户及申诉流程" />

      <div className="flex border-b border-[#E5E7EB] mb-5">
        {([ { key: "blacklist", label: "黑名单", href: "?tab=blacklist" }, { key: "appeals", label: "申诉管理", href: "?tab=appeals" } ] as const).map(({ key, label, href }) => (
          <Link key={key} href={href} className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === key ? "border-[#2D5A27] text-[#2D5A27]" : "border-transparent text-[#6B7280] hover:text-[#1F2937]"}`}>
            {label}
          </Link>
        ))}
      </div>

      {activeTab === "blacklist" && (
        <div className="rounded-lg border border-[#E5E7EB] bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F9FAFB]">
                {["用户 ID", "身份证", "车牌", "加入原因", "加入时间", "操作"].map((h) => (
                  <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {blacklistItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState message="暂无黑名单记录" />
                  </TableCell>
                </TableRow>
              ) : (
                blacklistItems.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-[#F9FAFB]">
                    <TableCell className="font-mono text-[12px] text-[#6B7280]">{entry.userId.slice(0, 8).toUpperCase()}…</TableCell>
                    <TableCell className="font-mono text-[13px] text-[#6B7280]">{maskIdCard(entry.idCard)}</TableCell>
                    <TableCell className="text-[13px] text-[#6B7280]">{entry.plate ?? "—"}</TableCell>
                    <TableCell className="text-[13px] text-[#1F2937] max-w-[240px] truncate">{entry.reason}</TableCell>
                    <TableCell className="text-[13px] text-[#6B7280]">{formatCnDateTime(entry.createdAt)}</TableCell>
                    <TableCell>
                      <RemoveBlacklistButton userId={entry.userId} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {activeTab === "appeals" && (
        <div className="rounded-lg border border-[#E5E7EB] bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F9FAFB]">
                {["申诉ID", "身份证", "申诉原因", "状态", "提交时间", "操作"].map((h) => (
                  <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {appealItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState message="暂无申诉记录" />
                  </TableCell>
                </TableRow>
              ) : (
                appealItems.map((appeal) => (
                  <TableRow key={appeal.id} className="hover:bg-[#F9FAFB]">
                    <TableCell className="font-mono text-[12px] text-[#6B7280]">{appeal.id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell className="font-mono text-[13px] text-[#6B7280]">{maskIdCard(appeal.blacklist.idCard)}</TableCell>
                    <TableCell className="text-[13px] text-[#1F2937] max-w-[260px] truncate">{appeal.reason}</TableCell>
                    <TableCell>
                      <StatusChip status={appeal.status === "APPROVED" ? "CONFIRMED" : appeal.status === "REJECTED" ? "CANCELLED" : "PENDING"} />
                    </TableCell>
                    <TableCell className="text-[13px] text-[#6B7280]">{formatCnDateTime(appeal.createdAt)}</TableCell>
                    <TableCell>
                      {appeal.status === "PENDING" ? (
                        <ReviewAppealButtons appealId={appeal.id} />
                      ) : (
                        <span className="text-[12px] text-[#9CA3AF]">已处理</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

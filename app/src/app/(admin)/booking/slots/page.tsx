import { bookingRepository } from "@/modules/booking";
import { PageHeader } from "@/lib/ui/page-header";
import { StatusChip } from "@/lib/ui/status-chip";
import { formatCnDate } from "@/shared/format";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "分时预约配额配置 · 长秋山管理后台" };

type Props = { searchParams: Promise<{ date?: string }> };

export default async function BookingSlotsPage({ searchParams }: Props) {
  const params = await searchParams;
  const target = params.date ? new Date(params.date + "T00:00:00+08:00") : new Date();
  target.setHours(0, 0, 0, 0);

  const slots = await bookingRepository.listSlotsByDate(target);

  const prevDate = new Date(target);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(target);
  nextDate.setDate(nextDate.getDate() + 1);

  const toDateParam = (d: Date) => d.toISOString().slice(0, 10);

  const hasPausedSlots = slots.some((s) => s.status === "PAUSED");
  const hasCircuitBreaker = slots.some((s) => s.capacity > 0 && s.checkedInCount / s.capacity >= 0.9);

  return (
    <>
      <PageHeader
        title="分时预约配额配置"
        description="设置各时段各渠道的预约名额上限"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/booking/slots?date=${toDateParam(prevDate)}`}
              className="px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-md hover:bg-gray-50 text-[#1F2937]"
            >
              ‹ 前一天
            </Link>
            <span className="text-sm font-medium text-[#1F2937]">{formatCnDate(target)}</span>
            <Link
              href={`/booking/slots?date=${toDateParam(nextDate)}`}
              className="px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-md hover:bg-gray-50 text-[#1F2937]"
            >
              后一天 ›
            </Link>
          </div>
        }
      />

      {(hasPausedSlots || hasCircuitBreaker) && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
          <p className="text-sm font-medium text-[#DC2626]">
            承载量达 90%，入园预约已自动暂停
          </p>
          <form>
            <button
              formAction={async () => {
                "use server";
                const { bookingService } = await import("@/modules/booking");
                await bookingService.resumePausedSlots(target);
              }}
              className="rounded-md bg-[#DC2626] px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
            >
              手动恢复
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
              <th className="py-3 px-4 text-left font-medium text-[#6B7280]">时段名</th>
              <th className="py-3 px-4 text-left font-medium text-[#6B7280]">开始</th>
              <th className="py-3 px-4 text-left font-medium text-[#6B7280]">结束</th>
              <th className="py-3 px-4 text-right font-medium text-[#6B7280]">总名额</th>
              <th className="py-3 px-4 text-right font-medium text-[#6B7280]">小程序</th>
              <th className="py-3 px-4 text-right font-medium text-[#6B7280]">现场</th>
              <th className="py-3 px-4 text-right font-medium text-[#6B7280]">OTA</th>
              <th className="py-3 px-4 text-right font-medium text-[#6B7280]">后台</th>
              <th className="py-3 px-4 text-right font-medium text-[#6B7280]">在园</th>
              <th className="py-3 px-4 text-left font-medium text-[#6B7280]">状态</th>
            </tr>
          </thead>
          <tbody>
            {slots.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-[13px] text-[#6B7280]">
                  当日暂无时段数据
                </td>
              </tr>
            ) : (
              slots.map((s) => {
                const circuitRed = s.capacity > 0 && s.checkedInCount / s.capacity >= 0.9;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-[#E5E7EB] last:border-0 hover:bg-gray-50"
                    style={circuitRed ? { backgroundColor: "#FEF2F2" } : undefined}
                  >
                    <td className="py-3 px-4 font-medium text-[#1F2937]">{s.name}</td>
                    <td className="py-3 px-4 text-[#6B7280]">{s.startTime}</td>
                    <td className="py-3 px-4 text-[#6B7280]">{s.endTime}</td>
                    <td className="py-3 px-4 text-right">{s.capacity}</td>
                    <td className="py-3 px-4 text-right text-xs">
                      {s.miniProgramBooked}/{s.miniProgramQuota}
                    </td>
                    <td className="py-3 px-4 text-right text-xs">
                      {s.onsiteBooked}/{s.onsiteQuota}
                    </td>
                    <td className="py-3 px-4 text-right text-xs">
                      {s.otaBooked}/{s.otaQuota}
                    </td>
                    <td className="py-3 px-4 text-right text-xs">
                      {s.adminBooked}/{s.adminQuota}
                    </td>
                    <td
                      className="py-3 px-4 text-right text-xs font-medium"
                      style={circuitRed ? { color: "#DC2626" } : undefined}
                    >
                      {s.checkedInCount}/{s.capacity}
                    </td>
                    <td className="py-3 px-4">
                      <StatusChip
                        status={
                          s.status === "ACTIVE"
                            ? "ACTIVE"
                            : s.status === "PAUSED"
                            ? "PAUSED"
                            : "CANCELLED"
                        }
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

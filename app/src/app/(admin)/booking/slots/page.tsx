import { bookingRepository, isCircuitBroken } from "@/modules/booking";
import { configService } from "@/modules/system";
import { CIRCUIT_BREAK_RATIO, resolveInstantCapacity } from "@/shared/lib/capacity";
import { requireRole, ADMIN_UP } from "@/infrastructure/auth/guard";
import { getSession } from "@/infrastructure/auth/session";
import { PageHeader } from "@/lib/ui/page-header";
import { StatusChip } from "@/lib/ui/status-chip";
import { formatCnDate } from "@/shared/format";
import { chinaTodayDbDate } from "@/shared/lib/time";
import { SlotTools } from "./_slot-tools";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "分时预约配额配置 · 长秋山管理后台" };

type Props = { searchParams: Promise<{ date?: string }> };

export default async function BookingSlotsPage({ searchParams }: Props) {
  const params = await searchParams;
  // target 锚 UTC 零点,与 @db.Date 存储口径(new Date(dateStr+"T00:00:00Z"))一致,
  // 不依赖服务器时区(Vercel=UTC 下原 setHours 本地零点会回退一天导致查空)。
  const target = params.date ? new Date(params.date + "T00:00:00Z") : chinaTodayDbDate();

  const slots = await bookingRepository.listSlotsByDate(target);

  const session = await getSession();
  const canManage =
    session?.appRole != null && (ADMIN_UP as readonly string[]).includes(session.appRole);

  const prevDate = new Date(target);
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const nextDate = new Date(target);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

  // target 锚 UTC 零点,日期参数一律走 UTC 方法,不依赖服务器时区
  const toDateParam = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  // 红线4 口径统一:熔断判定 = 当日全园在园人数(各时段 checked_in_count 之和)/ 瞬时承载量 ≥ 90%,
  // 不再用单时段 capacity 当分母(后者几乎永不触发,B4)。与 checkin 写路径同口径。
  const inParkCount = slots.reduce((sum, s) => sum + s.checkedInCount, 0);
  const instantCapacity = await configService.getInstantCapacity().catch(() => resolveInstantCapacity());
  const hasCircuitBreaker = isCircuitBroken(inParkCount, instantCapacity);

  return (
    <>
      <PageHeader
        title="分时预约配额配置"
        description="设置各时段各渠道的预约名额上限"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/booking/slots?date=${toDateParam(prevDate)}`}
              className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted/50 text-foreground"
            >
              ‹ 前一天
            </Link>
            <span className="text-sm font-medium text-foreground">{formatCnDate(target)}</span>
            <Link
              href={`/booking/slots?date=${toDateParam(nextDate)}`}
              className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted/50 text-foreground"
            >
              后一天 ›
            </Link>
          </div>
        }
      />

      {hasCircuitBreaker && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-danger/30 bg-danger/10 px-4 py-3">
          <p className="text-sm font-medium text-danger">
            承载量达 90%，入园预约已自动暂停
          </p>
          <form>
            <button
              formAction={async () => {
                "use server";
                // 解除承载力熔断属管理动作,OPERATOR 无权(PRD 红线4)
                const auth = await requireRole(ADMIN_UP);
                if (!auth.ok) return;
                const { bookingService } = await import("@/modules/booking");
                await bookingService.resumePausedSlots(target);
              }}
              className="rounded-md bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger/90"
            >
              手动恢复
            </button>
          </form>
        </div>
      )}

      {canManage && <SlotTools targetDate={toDateParam(target)} />}

      <div className="bg-card rounded-lg border border-border overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="py-3 px-4 text-left font-medium text-muted-foreground">时段名</th>
              <th className="py-3 px-4 text-left font-medium text-muted-foreground">开始</th>
              <th className="py-3 px-4 text-left font-medium text-muted-foreground">结束</th>
              <th className="py-3 px-4 text-right font-medium text-muted-foreground">总名额</th>
              <th className="py-3 px-4 text-right font-medium text-muted-foreground">小程序</th>
              <th className="py-3 px-4 text-right font-medium text-muted-foreground">现场</th>
              <th className="py-3 px-4 text-right font-medium text-muted-foreground">第三方平台</th>
              <th className="py-3 px-4 text-right font-medium text-muted-foreground">后台</th>
              <th className="py-3 px-4 text-right font-medium text-muted-foreground">在园</th>
              <th className="py-3 px-4 text-left font-medium text-muted-foreground">状态</th>
            </tr>
          </thead>
          <tbody>
            {slots.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-[13px] text-muted-foreground">
                  当日暂无时段数据
                </td>
              </tr>
            ) : (
              slots.map((s) => {
                // 行级提示:该时段自身核销饱和度(到达自身容量 90% 标红),与园区级熔断(上方 banner)口径不同
                const slotNearFull = s.capacity > 0 && s.checkedInCount / s.capacity >= CIRCUIT_BREAK_RATIO;
                return (
                  <tr
                    key={s.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/50 ${slotNearFull ? "bg-danger/10" : ""}`}
                  >
                    <td className="py-3 px-4 font-medium text-foreground">{s.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{s.startTime}</td>
                    <td className="py-3 px-4 text-muted-foreground">{s.endTime}</td>
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
                    <td className={`py-3 px-4 text-right text-xs font-medium ${slotNearFull ? "text-danger" : ""}`}>
                      {s.checkedInCount}/{s.capacity}
                    </td>
                    <td className="py-3 px-4">
                      <StatusChip
                        status={
                          s.status === "ACTIVE"
                            ? "ACTIVE"
                            : s.status === "PAUSED"
                            ? "PAUSED"
                            : s.status === "CLOSED"
                            ? "CLOSED"
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

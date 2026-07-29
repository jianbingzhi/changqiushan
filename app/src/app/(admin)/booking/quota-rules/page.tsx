import Link from "next/link";
import { PageHeader } from "@/lib/ui/page-header";
import { quotaRuleService } from "@/modules/booking";
import { configService } from "@/modules/system";
import { chinaToday } from "@/shared/lib/time";
import { QuotaRules, type TemplateRow, type HolidayRow } from "./_quota-rules";
import { QuotaCalendar } from "./_quota-calendar";

export const dynamic = "force-dynamic";
export const metadata = { title: "配额规则 · 长秋山管理后台" };

type SP = { view?: string; ym?: string };

function parseYm(ym: string | undefined): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(ym ?? "");
  if (m) return { year: Number(m[1]), month: Number(m[2]) };
  const [y, mo] = chinaToday().split("-");
  return { year: Number(y), month: Number(mo) };
}

export default async function QuotaRulesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = sp.view === "table" ? "table" : "calendar";
  const { year, month } = parseYm(sp.ym);

  const [templates, holidays, cells, limits] = await Promise.all([
    quotaRuleService.listTemplates().catch(() => []),
    quotaRuleService.listHolidays().catch(() => []),
    quotaRuleService.resolveMonth(year, month).catch(() => []),
    configService.getBookingLimits().catch(() => ({ dailyTotalStock: 0, perIdCard: 1, perPhone: 0 })),
  ]);

  const templateRows: TemplateRow[] = templates.map((t) => ({
    id: t.id, dayType: t.dayType, name: t.name, startTime: t.startTime, endTime: t.endTime,
    miniProgramQuota: t.miniProgramQuota, onsiteQuota: t.onsiteQuota, otaQuota: t.otaQuota,
    adminQuota: t.adminQuota, enabled: t.enabled,
  }));

  const holidayRows: HolidayRow[] = holidays.map((h) => ({
    date: h.date.toISOString().slice(0, 10), dayType: h.dayType, closed: h.closed, note: h.note,
  }));

  const tab = (key: "calendar" | "table", label: string) => {
    const active = view === key;
    return (
      <Link
        href={`/booking/quota-rules?view=${key}`}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
          active ? "border-primary text-primary-strong" : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <PageHeader
        title="配额规则"
        description="按日期类型定义时段模板,配特例日历;每日按规则派生各日时段名额(首单惰性物化)"
      />
      <div className="mb-5 flex border-b border-border">
        {tab("calendar", "配额日历")}
        {tab("table", "模板与特例")}
      </div>

      {view === "calendar" ? (
        <QuotaCalendar year={year} month={month} cells={cells} limits={limits} />
      ) : (
        <QuotaRules templates={templateRows} holidays={holidayRows} />
      )}
    </>
  );
}

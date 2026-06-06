import { PageHeader } from "@/lib/ui/page-header";
import { quotaRuleService } from "@/modules/booking";
import { QuotaRules, type TemplateRow, type HolidayRow } from "./_quota-rules";

export const dynamic = "force-dynamic";
export const metadata = { title: "配额规则 · 长秋山管理后台" };

export default async function QuotaRulesPage() {
  const [templates, holidays] = await Promise.all([
    quotaRuleService.listTemplates().catch(() => []),
    quotaRuleService.listHolidays().catch(() => []),
  ]);

  const templateRows: TemplateRow[] = templates.map((t) => ({
    id: t.id,
    dayType: t.dayType,
    name: t.name,
    startTime: t.startTime,
    endTime: t.endTime,
    miniProgramQuota: t.miniProgramQuota,
    onsiteQuota: t.onsiteQuota,
    otaQuota: t.otaQuota,
    adminQuota: t.adminQuota,
    enabled: t.enabled,
  }));

  const holidayRows: HolidayRow[] = holidays.map((h) => ({
    date: h.date.toISOString().slice(0, 10),
    dayType: h.dayType,
    closed: h.closed,
    note: h.note,
  }));

  return (
    <>
      <PageHeader
        title="配额规则"
        description="按日期类型定义时段模板,配特例日历;每日滚动生成据此展开各日时段名额"
      />
      <QuotaRules templates={templateRows} holidays={holidayRows} />
    </>
  );
}

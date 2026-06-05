import { analyticsRepository } from "@/modules/analytics";
import { PageHeader } from "@/lib/ui/page-header";
import { FileDown } from "lucide-react";
import { ProfileTabs } from "./_profile-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "用户画像 · 长秋山管理后台" };

export default async function AnalyticsProfilePage() {
  const [overviewRaw, travelRaw] = await Promise.all([
    analyticsRepository.getProfileOverview(),
    analyticsRepository.getTravelPreference(),
  ]);
  const overview = overviewRaw.map((r) => ({ dimension: r.dimension, value: Number(r.value), percentage: r.percentage }));
  const travel = travelRaw.map((r) => ({ dimension: r.dimension, value: Number(r.value), percentage: r.percentage }));

  return (
    <>
      <PageHeader title="用户画像" description="游客出行特征与偏好分析"
        actions={
          <a href="/api/export/profile" download className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#1F2937] hover:bg-[#F9FAFB]">
            <FileDown className="h-4 w-4 text-[#6B7280]" />导出 Excel
          </a>
        }
      />
      {/* B17/B18/B19 合并为三 Tab (R3 决策) */}
      <ProfileTabs overview={overview} travel={travel} />
    </>
  );
}

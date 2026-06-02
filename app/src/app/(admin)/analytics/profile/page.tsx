import { PageHeader } from "@/lib/ui/page-header";
import { FileDown } from "lucide-react";
import { ProfileTabs } from "./_profile-tabs";

// TODO: import { analyticsRepository } from "@/modules/analytics"; (getProfileOverview/getTravelPreference/getAppPreference)
export const dynamic = "force-dynamic";
export const metadata = { title: "用户画像 · 长秋山管理后台" };

export default async function AnalyticsProfilePage() {
  return (
    <>
      <PageHeader title="用户画像" description="游客出行特征与偏好分析（B17总览/B18出行偏好/B19APP偏好）"
        actions={
          <a href="/api/export/profile" download className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#1F2937] hover:bg-[#F9FAFB]">
            <FileDown className="h-4 w-4 text-[#6B7280]" />导出 Excel
          </a>
        }
      />
      {/* B17/B18/B19 合并为三 Tab (R3 决策) */}
      <ProfileTabs />
    </>
  );
}

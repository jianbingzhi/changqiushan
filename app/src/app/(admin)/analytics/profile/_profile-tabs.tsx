"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/lib/ui/tabs";
import { EmptyState } from "@/lib/ui/empty-state";

export function ProfileTabs() {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="mb-4 bg-[#F3F4F6] border border-[#E5E7EB]">
        <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-[#2D5A27] data-[state=active]:shadow-sm">总览</TabsTrigger>
        <TabsTrigger value="travel"   className="data-[state=active]:bg-white data-[state=active]:text-[#2D5A27] data-[state=active]:shadow-sm">出行偏好</TabsTrigger>
        <TabsTrigger value="app"      className="data-[state=active]:bg-white data-[state=active]:text-[#2D5A27] data-[state=active]:shadow-sm">APP 偏好</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <div className="rounded-lg border border-[#E5E7EB] bg-white">
          {/* TODO: analyticsRepository.getProfileOverview() → 性别比例/年龄分布/重游率 */}
          <EmptyState message="用户画像总览数据准备中" />
        </div>
      </TabsContent>
      <TabsContent value="travel">
        <div className="rounded-lg border border-[#E5E7EB] bg-white">
          {/* TODO: analyticsRepository.getTravelPreference() → 入园时段/自驾比例/来源城市 */}
          <EmptyState message="出行偏好数据准备中" />
        </div>
      </TabsContent>
      <TabsContent value="app">
        <div className="rounded-lg border border-[#E5E7EB] bg-white">
          {/* TODO: analyticsRepository.getAppPreference() → 功能使用频率/留存率 */}
          <EmptyState message="APP 偏好数据准备中" />
        </div>
      </TabsContent>
    </Tabs>
  );
}

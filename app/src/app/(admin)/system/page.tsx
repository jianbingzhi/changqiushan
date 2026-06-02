import { PageHeader } from "@/lib/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/lib/ui/tabs";
import { EmptyState } from "@/lib/ui/empty-state";

export const metadata = {
  title: "系统管理 · 长秋山森林公园智慧景区管理后台",
};

export default function SystemPage() {
  return (
    <>
      <PageHeader
        title="系统管理"
        description="账号管理、角色权限、操作审计"
      />
      <Tabs defaultValue="accounts">
        <TabsList className="mb-6">
          <TabsTrigger value="accounts">账号管理</TabsTrigger>
          <TabsTrigger value="roles">角色权限</TabsTrigger>
          <TabsTrigger value="audit">操作审计</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          {/* TODO 阶段1: 接入 system 模块 adminService */}
          <EmptyState message="暂无账号数据" />
        </TabsContent>
        <TabsContent value="roles">
          {/* TODO 阶段1: 接入 system 模块 rbacService */}
          <EmptyState message="暂无角色数据" />
        </TabsContent>
        <TabsContent value="audit">
          {/* TODO 阶段1: 接入 system 模块审计日志 */}
          <EmptyState message="暂无审计记录" />
        </TabsContent>
      </Tabs>
    </>
  );
}

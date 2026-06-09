import { systemRepository } from "@/modules/system";
import { PageHeader } from "@/lib/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/lib/ui/tabs";
import { StatusChip } from "@/lib/ui/status-chip";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { formatCnDateTime } from "@/shared/format";
import { CreateAdminForm, AccountRowActions } from "./_account-manager";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "系统管理 · 长秋山森林公园智慧景区管理后台",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "超级管理员", ADMIN: "管理员", OPERATOR: "操作员",
};

export default async function SystemPage() {
  const [profiles, roles, audits] = await Promise.all([
    systemRepository.findAllProfiles(),
    systemRepository.listRolesWithPermissions(),
    systemRepository.listAuditLogs(100),
  ]);

  return (
    <>
      <PageHeader title="系统管理" description="账号管理、角色权限、操作审计" />
      <Tabs defaultValue="accounts">
        <TabsList className="mb-6">
          <TabsTrigger value="accounts">账号管理</TabsTrigger>
          <TabsTrigger value="roles">角色权限</TabsTrigger>
          <TabsTrigger value="audit">操作审计</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <CreateAdminForm />
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  {["姓名", "工号", "角色", "状态", "创建时间", "操作"].map((h) => (
                    <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="p-0"><EmptyState message="暂无账号数据" /></TableCell></TableRow>
                ) : profiles.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted">
                    <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{p.workerId ?? "—"}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {p.roles.map((r) => ROLE_LABELS[r.role.code] ?? r.role.code).join("、") || "—"}
                    </TableCell>
                    <TableCell><StatusChip status={p.status === "ACTIVE" ? "ACTIVE" : "CANCELLED"} /></TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{formatCnDateTime(p.createdAt)}</TableCell>
                    <TableCell><AccountRowActions profileId={p.id} disabled={p.status === "DISABLED"} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <div className="space-y-4">
            {roles.length === 0 ? (
              <EmptyState message="暂无角色数据" />
            ) : roles.map((role) => (
              <div key={role.id} className="rounded-lg border border-border bg-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-foreground">{ROLE_LABELS[role.code] ?? role.name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{role.code}</span>
                  <span className="text-[12px] text-text-muted">{role.permissions.length} 项权限</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.length === 0 ? (
                    <span className="text-[13px] text-text-muted">无权限</span>
                  ) : role.permissions.map((rp) => (
                    <span key={rp.permission.id} className="rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-2.5 py-1 text-[12px] text-primary">
                      {rp.permission.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  {["时间", "操作人", "动作", "资源", "详情"].map((h) => (
                    <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="p-0"><EmptyState message="暂无审计记录" /></TableCell></TableRow>
                ) : audits.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted">
                    <TableCell className="text-[13px] text-muted-foreground">{formatCnDateTime(log.createdAt)}</TableCell>
                    <TableCell className="font-mono text-[12px] text-muted-foreground">{log.actorId.slice(0, 8)}…</TableCell>
                    <TableCell className="text-[13px] font-medium text-foreground">{log.action}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{log.resource}</TableCell>
                    <TableCell className="font-mono text-[12px] text-muted-foreground max-w-[280px] truncate">
                      {log.detail ? JSON.stringify(log.detail) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

import Link from "next/link";
import { Search, Download } from "lucide-react";
import { bookingService } from "@/modules/booking";
import type { BookingStatus } from "@/modules/booking";
import { PageHeader } from "@/lib/ui/page-header";
import { StatusChip } from "@/lib/ui/status-chip";
import { EmptyState } from "@/lib/ui/empty-state";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/lib/ui/table";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis, PaginationSummary,
} from "@/lib/ui/pagination";
import { formatCnDateTime } from "@/shared/format";
import { channelLabel } from "@/shared/labels";
import { CheckinButton } from "./_checkin-button";

const PAGE_SIZE = 20;

// 生成 1..totalPages 的页码窗口(首尾常驻 + 当前页±1,其余折叠为 ellipsis)
function pageWindow(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "...")[] = [1];
  const lo = Math.max(2, current - 1);
  const hi = Math.min(total - 1, current + 1);
  if (lo > 2) out.push("...");
  for (let p = lo; p <= hi; p++) out.push(p);
  if (hi < total - 1) out.push("...");
  out.push(total);
  return out;
}

export const dynamic = "force-dynamic";
export const metadata = { title: "预约单查询 · 长秋山管理后台" };

const VALID_STATUS = ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW", "EXPIRED"] as const;

const STATUS_LABEL: Record<BookingStatus, string> = {
  CONFIRMED: "已预约", CHECKED_IN: "已核销", CANCELLED: "已取消", NO_SHOW: "爽约", EXPIRED: "已过期",
};

function maskIdCard(id: string) {
  return id.length >= 8 ? `${id.slice(0, 4)}***${id.slice(-4)}` : id;
}

type SearchParams = { idCard?: string; phone?: string; status?: string; page?: string };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const idCard = sp.idCard ?? "";
  const phone  = sp.phone ?? "";
  const status = sp.status ?? "";
  const pageNum = Math.max(Number.parseInt(sp.page ?? "1", 10) || 1, 1);

  const statusFilter = (VALID_STATUS as readonly string[]).includes(status)
    ? (status as BookingStatus)
    : undefined;
  const filter = {
    idCard: idCard || undefined,
    phone: phone || undefined,
    status: statusFilter,
  };
  const { items, total, page, totalPages } = await bookingService.listBookingsPaged(
    filter, pageNum, PAGE_SIZE,
  );

  // 保持当前筛选条件、仅替换 page 的链接构造器
  const hrefFor = (p: number) => {
    const q = new URLSearchParams();
    if (idCard) q.set("idCard", idCard);
    if (phone) q.set("phone", phone);
    if (status) q.set("status", status);
    if (p > 1) q.set("page", String(p));
    return `/booking/bookings${q.toString() ? "?" + q.toString() : ""}`;
  };
  const exportQs = (() => {
    const q = new URLSearchParams();
    if (idCard) q.set("idCard", idCard);
    if (phone) q.set("phone", phone);
    if (status) q.set("status", status);
    return q.toString() ? "?" + q.toString() : "";
  })();

  return (
    <>
      <PageHeader title="预约单查询" description={`按条件筛选预约记录 · 累计预约 ${total} 条`} />

      {/* 搜索栏 */}
      <form method="GET" className="flex flex-wrap items-end gap-3 mb-4">
        {[
          { name: "idCard", label: "身份证号", placeholder: "输入身份证号", defaultValue: idCard, width: "w-44" },
          { name: "phone",  label: "手机号",   placeholder: "输入手机号",   defaultValue: phone,  width: "w-36" },
        ].map(({ name, label, placeholder, defaultValue, width }) => (
          <div key={name} className="flex flex-col gap-1">
            <label className="text-[12px] text-muted-foreground font-medium">{label}</label>
            <input
              name={name}
              defaultValue={defaultValue}
              placeholder={placeholder}
              className={`h-9 ${width} rounded-md border border-border bg-card px-3 text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30`}
            />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-muted-foreground font-medium">状态</label>
          <select name="status" defaultValue={status} className="h-9 w-32 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">全部</option>
            <option value="CONFIRMED">已预约</option>
            <option value="CHECKED_IN">已核销</option>
            <option value="CANCELLED">已取消</option>
            <option value="NO_SHOW">爽约</option>
            <option value="EXPIRED">已过期</option>
          </select>
        </div>
        <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-white hover:opacity-90">
          <Search className="h-3.5 w-3.5" /> 搜索
        </button>
        <Link href="/booking/bookings" className="inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-sm text-muted-foreground hover:border-primary/40">
          清空
        </Link>
        <a
          href={`/api/export/bookings${exportQs}`}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-primary/40 bg-card px-4 text-sm font-medium text-primary hover:bg-primary/5"
        >
          <Download className="h-3.5 w-3.5" /> 导出 Excel
        </a>
      </form>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        {[["", "全部"], ["CONFIRMED", "已预约"], ["CHECKED_IN", "已核销"], ["CANCELLED", "已取消"]].map(([v, label]) => {
          const p = new URLSearchParams();
          if (idCard) p.set("idCard", idCard);
          if (phone) p.set("phone", phone);
          if (v) p.set("status", v);
          const isActive = status === v;
          return (
            <Link key={v} href={`/booking/bookings${p.toString() ? "?" + p.toString() : ""}`}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {label}
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table density="compact">
          <TableHeader>
            <TableRow className="bg-muted">
              {["预约编号", "姓名", "身份证", "手机号", "车牌", "渠道", "时段", "状态", "核销时间", "操作"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="p-0">
                  <EmptyState message="未查询到符合条件的预约记录" />
                </TableCell>
              </TableRow>
            ) : (
              items.map((booking) => (
                <TableRow key={booking.id} className="hover:bg-muted">
                  <TableCell className="font-mono text-[12px] text-muted-foreground">{booking.qrCode.slice(0, 10).toUpperCase()}</TableCell>
                  <TableCell className="text-sm font-medium text-foreground">{booking.visitorName}</TableCell>
                  <TableCell className="font-mono text-[13px] text-muted-foreground">{maskIdCard(booking.idCard)}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{booking.phone}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{booking.plate ?? (booking.noVehicleDeclared ? "无车辆" : "—")}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {channelLabel(booking.channel)}
                    </span>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {booking.slot.name}
                    <span className="ml-1 text-xs text-text-muted">{booking.slot.startTime}–{booking.slot.endTime}</span>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={booking.status === "CONFIRMED" ? "CONFIRMED" : booking.status === "CHECKED_IN" ? "CHECKED_IN" : "CANCELLED"} />
                    {(booking.status === "NO_SHOW" || booking.status === "EXPIRED") && (
                      <span className="ml-1 text-xs text-muted-foreground">{STATUS_LABEL[booking.status]}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {booking.checkedInAt ? formatCnDateTime(booking.checkedInAt) : "—"}
                  </TableCell>
                  <TableCell>
                    {booking.status === "CONFIRMED" ? (
                      <CheckinButton qrCode={booking.qrCode} />
                    ) : (
                      <span className="text-[12px] text-text-muted">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <PaginationSummary total={total} page={page} totalPages={totalPages} />
          {totalPages > 1 && (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href={hrefFor(page - 1)}
                    aria-disabled={page <= 1}
                    className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
                {pageWindow(page, totalPages).map((p, i) =>
                  p === "..." ? (
                    <PaginationItem key={`e${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink href={hrefFor(p)} isActive={p === page}>
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    href={hrefFor(page + 1)}
                    aria-disabled={page >= totalPages}
                    className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </>
  );
}

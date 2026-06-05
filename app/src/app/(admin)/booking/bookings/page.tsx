import Link from "next/link";
import { Search } from "lucide-react";
import { bookingRepository } from "@/modules/booking";
import type { BookingStatus } from "@/modules/booking";
import { PageHeader } from "@/lib/ui/page-header";
import { StatusChip } from "@/lib/ui/status-chip";
import { EmptyState } from "@/lib/ui/empty-state";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/lib/ui/table";
import { formatCnDateTime } from "@/shared/format";
import { channelLabel } from "@/shared/labels";
import { CheckinButton } from "./_checkin-button";

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

  const totalCount = await bookingRepository.countBookings();

  const statusFilter = (VALID_STATUS as readonly string[]).includes(status)
    ? (status as BookingStatus)
    : undefined;
  const items = await bookingRepository.listBookings({
    idCard: idCard || undefined,
    phone: phone || undefined,
    status: statusFilter,
  });

  return (
    <>
      <PageHeader title="预约单查询" description={`按条件筛选预约记录 · 累计预约 ${totalCount} 条`} />

      {/* 搜索栏 */}
      <form method="GET" className="flex flex-wrap items-end gap-3 mb-4">
        {[
          { name: "idCard", label: "身份证号", placeholder: "输入身份证号", defaultValue: idCard, width: "w-44" },
          { name: "phone",  label: "手机号",   placeholder: "输入手机号",   defaultValue: phone,  width: "w-36" },
        ].map(({ name, label, placeholder, defaultValue, width }) => (
          <div key={name} className="flex flex-col gap-1">
            <label className="text-[12px] text-[#6B7280] font-medium">{label}</label>
            <input
              name={name}
              defaultValue={defaultValue}
              placeholder={placeholder}
              className={`h-9 ${width} rounded-md border border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/30`}
            />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-[#6B7280] font-medium">状态</label>
          <select name="status" defaultValue={status} className="h-9 w-32 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/30">
            <option value="">全部</option>
            <option value="CONFIRMED">已预约</option>
            <option value="CHECKED_IN">已核销</option>
            <option value="CANCELLED">已取消</option>
            <option value="NO_SHOW">爽约</option>
          </select>
        </div>
        <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2D5A27] px-4 text-sm font-medium text-white hover:opacity-90">
          <Search className="h-3.5 w-3.5" /> 搜索
        </button>
        <Link href="/booking/bookings" className="inline-flex h-9 items-center rounded-md border border-[#E5E7EB] bg-white px-4 text-sm text-[#6B7280] hover:border-[#2D5A27]/40">
          清空
        </Link>
      </form>

      {/* Tabs */}
      <div className="flex border-b border-[#E5E7EB] mb-4">
        {[["", "全部"], ["CONFIRMED", "已预约"], ["CHECKED_IN", "已核销"], ["CANCELLED", "已取消"]].map(([v, label]) => {
          const p = new URLSearchParams();
          if (idCard) p.set("idCard", idCard);
          if (phone) p.set("phone", phone);
          if (v) p.set("status", v);
          const isActive = status === v;
          return (
            <Link key={v} href={`/booking/bookings${p.toString() ? "?" + p.toString() : ""}`}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${isActive ? "border-[#2D5A27] text-[#2D5A27]" : "border-transparent text-[#6B7280] hover:text-[#1F2937]"}`}>
              {label}
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#E5E7EB] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              {["预约编号", "姓名", "身份证", "手机号", "车牌", "渠道", "时段", "状态", "核销时间", "操作"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
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
                <TableRow key={booking.id} className="hover:bg-[#F9FAFB]">
                  <TableCell className="font-mono text-[12px] text-[#6B7280]">{booking.qrCode.slice(0, 10).toUpperCase()}</TableCell>
                  <TableCell className="text-sm font-medium text-[#1F2937]">{booking.visitorName}</TableCell>
                  <TableCell className="font-mono text-[13px] text-[#6B7280]">{maskIdCard(booking.idCard)}</TableCell>
                  <TableCell className="text-[13px] text-[#6B7280]">{booking.phone}</TableCell>
                  <TableCell className="text-[13px] text-[#6B7280]">{booking.plate ?? (booking.noVehicleDeclared ? "无车辆" : "—")}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-xs text-[#6B7280]">
                      {channelLabel(booking.channel)}
                    </span>
                  </TableCell>
                  <TableCell className="text-[13px] text-[#6B7280]">
                    {booking.slot.name}
                    <span className="ml-1 text-xs text-[#9CA3AF]">{booking.slot.startTime}–{booking.slot.endTime}</span>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={booking.status === "CONFIRMED" ? "CONFIRMED" : booking.status === "CHECKED_IN" ? "CHECKED_IN" : "CANCELLED"} />
                    {(booking.status === "NO_SHOW" || booking.status === "EXPIRED") && (
                      <span className="ml-1 text-xs text-[#6B7280]">{STATUS_LABEL[booking.status]}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-[#6B7280]">
                    {booking.checkedInAt ? formatCnDateTime(booking.checkedInAt) : "—"}
                  </TableCell>
                  <TableCell>
                    {booking.status === "CONFIRMED" ? (
                      <CheckinButton qrCode={booking.qrCode} />
                    ) : (
                      <span className="text-[12px] text-[#9CA3AF]">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

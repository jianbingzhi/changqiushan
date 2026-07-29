"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

import type { DayCell } from "@/modules/booking"
import { DateGrid, type DayMeta } from "@/lib/ui/date-grid"
import { DatePicker } from "@/lib/ui/date-picker"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/lib/ui/sheet"
import { Button } from "@/lib/ui/button"
import { Input } from "@/lib/ui/input"
import { cn } from "@/lib/ui/utils"
import {
  saveHolidayAction,
  deleteHolidayAction,
  applyRangeRuleAction,
  saveBookingLimitsAction,
} from "./actions"

// B31 配额日历视图:把 B26「派生/物化」语义投射到信息密度月历;特例编辑/区间套规则/总量阈值三抽屉。
// 一切动作走 ./actions(server action),成功后 router.refresh() 让 RSC 重算当月格子。

type DayType = "WEEKDAY" | "WEEKEND" | "HOLIDAY"

const DAY_TYPE_OPTIONS: { value: DayType; label: string }[] = [
  { value: "WEEKDAY", label: "工作日" },
  { value: "WEEKEND", label: "周末" },
  { value: "HOLIDAY", label: "节假日" },
]

const pad2 = (n: number) => String(n).padStart(2, "0")

const selectCls =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
const labelCls = "block text-[12px] font-medium text-muted-foreground"

function occupancy(cell: DayCell): number {
  return cell.totalQuota > 0 ? Math.round((cell.usedQuota / cell.totalQuota) * 100) : 0
}

// 占用率分档配色:<70% 绿(primary)/70-90% 琥珀/≥90% 红(danger)
function barColor(pct: number): string {
  if (pct >= 90) return "bg-danger"
  if (pct >= 70) return "bg-warning"
  return "bg-primary"
}

export function QuotaCalendar(props: {
  year: number
  month: number
  cells: DayCell[]
  limits: { dailyTotalStock: number; perIdCard: number; perPhone: number }
}) {
  const { year, month, cells, limits } = props
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  // 按 YYYY-MM-DD 建索引,renderDay 内 O(1) 命中
  const cellMap = React.useMemo(() => {
    const m = new Map<string, DayCell>()
    for (const c of cells) m.set(c.date, c)
    return m
  }, [cells])

  // 上/下月份算术(month 为 1-12)
  const prevM0 = month - 2
  const prevYear = prevM0 < 0 ? year - 1 : year
  const prevMonth = ((prevM0 % 12) + 12) % 12 + 1
  const nextM0 = month
  const nextYear = nextM0 > 11 ? year + 1 : year
  const nextMonth = (nextM0 % 12) + 1
  const monthHref = (y: number, m: number) =>
    `/booking/quota-rules?view=calendar&ym=${y}-${pad2(m)}`

  // —— 单日特例编辑抽屉状态 ——
  const [dayOpen, setDayOpen] = React.useState(false)
  const [editDate, setEditDate] = React.useState("")
  const [dayType, setDayType] = React.useState<DayType>("WEEKDAY")
  const [closed, setClosed] = React.useState(false)
  const [note, setNote] = React.useState("")
  const [dayMsg, setDayMsg] = React.useState<{ ok: boolean; text: string } | null>(null)

  const openDayEditor = (date: string) => {
    const cell = cellMap.get(date)
    setEditDate(date)
    setDayType((cell?.dayType as DayType) ?? "WEEKDAY")
    setClosed(cell?.source === "CLOSED")
    setNote("")
    setDayMsg(null)
    setDayOpen(true)
  }

  const submitDay = () => {
    setDayMsg(null)
    startTransition(async () => {
      const res = await saveHolidayAction({
        date: editDate,
        dayType,
        closed,
        note: note.trim() || undefined,
      })
      if (res.ok) {
        setDayOpen(false)
        router.refresh()
      } else {
        setDayMsg({ ok: false, text: res.message })
      }
    })
  }

  const clearDay = () => {
    setDayMsg(null)
    startTransition(async () => {
      const res = await deleteHolidayAction(editDate)
      if (res.ok) {
        setDayOpen(false)
        router.refresh()
      } else {
        setDayMsg({ ok: false, text: res.message })
      }
    })
  }

  // —— 区间套规则抽屉状态 ——
  const [rangeOpen, setRangeOpen] = React.useState(false)
  const [rangeStart, setRangeStart] = React.useState("")
  const [rangeEnd, setRangeEnd] = React.useState("")
  const [rangeType, setRangeType] = React.useState<DayType>("WEEKDAY")
  const [rangeClosed, setRangeClosed] = React.useState(false)
  const [rangeNote, setRangeNote] = React.useState("")
  const [rangeMsg, setRangeMsg] = React.useState<{ ok: boolean; text: string } | null>(null)

  const submitRange = () => {
    setRangeMsg(null)
    if (!rangeStart || !rangeEnd) {
      setRangeMsg({ ok: false, text: "请先选择起始日期与结束日期" })
      return
    }
    if (rangeStart > rangeEnd) {
      setRangeMsg({ ok: false, text: "起始日期不能晚于结束日期" })
      return
    }
    startTransition(async () => {
      const res = await applyRangeRuleAction({
        startDate: rangeStart,
        endDate: rangeEnd,
        dayType: rangeType,
        closed: rangeClosed,
        note: rangeNote.trim() || undefined,
      })
      setRangeMsg({ ok: res.ok, text: res.message })
      if (res.ok) router.refresh()
    })
  }

  // —— 预约总量规则抽屉状态 ——
  const [limitsOpen, setLimitsOpen] = React.useState(false)
  const [dailyTotalStock, setDailyTotalStock] = React.useState(String(limits.dailyTotalStock))
  const [perIdCard, setPerIdCard] = React.useState(String(limits.perIdCard))
  const [perPhone, setPerPhone] = React.useState(String(limits.perPhone))
  const [limitsMsg, setLimitsMsg] = React.useState<{ ok: boolean; text: string } | null>(null)

  const openLimits = () => {
    setDailyTotalStock(String(limits.dailyTotalStock))
    setPerIdCard(String(limits.perIdCard))
    setPerPhone(String(limits.perPhone))
    setLimitsMsg(null)
    setLimitsOpen(true)
  }

  const submitLimits = () => {
    setLimitsMsg(null)
    startTransition(async () => {
      const res = await saveBookingLimitsAction({
        dailyTotalStock: Number(dailyTotalStock) || 0,
        perIdCard: Math.max(1, Number(perIdCard) || 1),
        perPhone: Number(perPhone) || 0,
      })
      setLimitsMsg({ ok: res.ok, text: res.message })
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* 工具栏:月份导航 + 三个动作入口 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={monthHref(prevYear, prevMonth)}
            aria-label="上个月"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-32 text-center text-[15px] font-semibold text-foreground">
            {year} 年 {month} 月
          </span>
          <Link
            href={monthHref(nextYear, nextMonth)}
            aria-label="下个月"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRangeOpen(true)}>
            按区间套规则
          </Button>
          <Button variant="outline" size="sm" onClick={openLimits}>
            预约总量规则
          </Button>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded border border-border bg-card" />
          实线=已物化
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded border border-dashed border-border bg-card" />
          虚线=按规则派生
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          特例
        </span>
        <span className="inline-flex items-center gap-1.5 line-through">闭园</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-6 rounded-full bg-primary" />
          &lt;70%
          <span className="ml-1 inline-block h-2 w-6 rounded-full bg-amber-500" />
          70-90%
          <span className="ml-1 inline-block h-2 w-6 rounded-full bg-danger" />
          ≥90%
        </span>
      </div>

      {/* 月历主体 */}
      <div className="rounded-lg border border-border bg-card p-3">
        <DateGrid
          year={year}
          month={month}
          onSelect={(date) => openDayEditor(date)}
          renderDay={(meta: DayMeta) => {
            const cell = cellMap.get(meta.date)
            // 无数据兜底:仅显示日期数字
            if (!cell) {
              return (
                <span className="text-[13px] text-muted-foreground">{meta.day}</span>
              )
            }
            const isClosed = cell.source === "CLOSED"
            const isDerived = !cell.materialized
            const isOverride = cell.source === "OVERRIDE"
            const pct = occupancy(cell)
            return (
              <div
                className={cn(
                  "relative flex w-full flex-col items-stretch justify-between gap-1 rounded-md border p-1 text-left",
                  isDerived ? "border-dashed border-border" : "border-solid border-border",
                  isClosed && "bg-muted opacity-70",
                )}
              >
                {/* 顶部:日期数字 + 角标 */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-[13px] font-medium text-foreground",
                      isClosed && "text-muted-foreground line-through",
                      meta.isToday && "text-primary-strong",
                    )}
                  >
                    {meta.day}
                  </span>
                  <span className="flex items-center gap-1">
                    {isDerived && !isClosed && (
                      <span className="rounded bg-muted px-1 text-[12px] leading-tight text-muted-foreground">
                        派生
                      </span>
                    )}
                    {isOverride && (
                      <span
                        title="特例"
                        className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
                      />
                    )}
                  </span>
                </div>

                {/* 底部:名额/占用 + 迷你占用条;闭园则显示闭园 */}
                {isClosed ? (
                  <span className="text-[12px] text-muted-foreground line-through">闭园</span>
                ) : (
                  <div className="space-y-1">
                    <span className="block text-[12px] text-muted-foreground">
                      名额{cell.totalQuota}·占{pct}%
                    </span>
                    <div
                      className="h-1 w-full overflow-hidden rounded-full bg-muted"
                      role="presentation"
                    >
                      <div
                        className={cn("h-full rounded-full", barColor(pct))}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          }}
        />
      </div>

      {/* —— 单日特例编辑抽屉 —— */}
      <Sheet open={dayOpen} onOpenChange={setDayOpen}>
        <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>编辑当日特例</SheetTitle>
            <p className="text-[12px] text-muted-foreground">{editDate}</p>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="day-type">
                日期类型
              </label>
              <select
                id="day-type"
                className={selectCls}
                value={dayType}
                onChange={(e) => setDayType(e.target.value as DayType)}
              >
                {DAY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={closed}
                onChange={(e) => setClosed(e.target.checked)}
              />
              闭园(当日不开放预约)
            </label>
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="day-note">
                备注(可选)
              </label>
              <Input
                id="day-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="如:法定假日调休"
                className="text-[13px]"
              />
            </div>
            {dayMsg && (
              <p className={cn("text-[12px]", dayMsg.ok ? "text-primary-strong" : "text-danger-strong")}>
                {dayMsg.text}
              </p>
            )}
          </div>
          <SheetFooter className="mt-auto gap-2">
            <Button variant="ghost" size="sm" disabled={pending} onClick={clearDay}>
              清除特例
            </Button>
            <Button size="sm" disabled={pending} onClick={submitDay}>
              {pending ? "保存中…" : "保存"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* —— 按区间套规则抽屉 —— */}
      <Sheet open={rangeOpen} onOpenChange={setRangeOpen}>
        <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>按区间套规则</SheetTitle>
            <p className="text-[12px] text-muted-foreground">
              对所选日期区间批量写入特例;写特例,不触发物化。
            </p>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls}>起始日期</label>
              <DatePicker
                name="rangeStart"
                value={rangeStart}
                onChange={setRangeStart}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>结束日期</label>
              <DatePicker
                name="rangeEnd"
                value={rangeEnd}
                onChange={setRangeEnd}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="range-type">
                日期类型
              </label>
              <select
                id="range-type"
                className={selectCls}
                value={rangeType}
                onChange={(e) => setRangeType(e.target.value as DayType)}
              >
                {DAY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={rangeClosed}
                onChange={(e) => setRangeClosed(e.target.checked)}
              />
              整段闭园
            </label>
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="range-note">
                备注(可选)
              </label>
              <Input
                id="range-note"
                value={rangeNote}
                onChange={(e) => setRangeNote(e.target.value)}
                placeholder="如:五一连假"
                className="text-[13px]"
              />
            </div>
            {rangeMsg && (
              <p className={cn("text-[12px]", rangeMsg.ok ? "text-primary-strong" : "text-danger-strong")}>
                {rangeMsg.text}
              </p>
            )}
          </div>
          <SheetFooter className="mt-auto">
            <Button size="sm" disabled={pending} onClick={submitRange}>
              {pending ? "保存中…" : "保存"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* —— 预约总量规则抽屉 —— */}
      <Sheet open={limitsOpen} onOpenChange={setLimitsOpen}>
        <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>预约总量规则</SheetTitle>
            <p className="text-[12px] text-muted-foreground">
              防黄牛阈值:控制每日总量与单人单日上限。
            </p>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="limit-stock">
                每日总库存上限(0 = 不限)
              </label>
              <Input
                id="limit-stock"
                type="number"
                min={0}
                value={dailyTotalStock}
                onChange={(e) => setDailyTotalStock(e.target.value)}
                className="text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="limit-idcard">
                单身份证单日上限(最小 1)
              </label>
              <Input
                id="limit-idcard"
                type="number"
                min={1}
                value={perIdCard}
                onChange={(e) => setPerIdCard(e.target.value)}
                className="text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="limit-phone">
                单手机号单日上限(0 = 不限)
              </label>
              <Input
                id="limit-phone"
                type="number"
                min={0}
                value={perPhone}
                onChange={(e) => setPerPhone(e.target.value)}
                className="text-[13px]"
              />
            </div>
            {limitsMsg && (
              <p className={cn("text-[12px]", limitsMsg.ok ? "text-primary-strong" : "text-danger-strong")}>
                {limitsMsg.text}
              </p>
            )}
          </div>
          <SheetFooter className="mt-auto">
            <Button size="sm" disabled={pending} onClick={submitLimits}>
              {pending ? "保存中…" : "保存"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

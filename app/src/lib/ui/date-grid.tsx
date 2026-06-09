"use client"

import * as React from "react"
import { cn } from "@/lib/ui/utils"

// B27/B31 共用日期网格内核。纯展示 + 选择,月份切换由父组件控制(受控 year/month)。
// 一切以 YYYY-MM-DD 字符串为契约,不做 Date 运算跨时区漂移:仅用本地构造取「当月天数」「首日星期」。

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"] as const // 周一为首列

const pad = (n: number) => String(n).padStart(2, "0")
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

export function parseYmd(s?: string): { y: number; m: number; d: number } | null {
  if (!s) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

export function todayYmd(): string {
  const now = new Date()
  return ymd(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export type DayMeta = {
  /** YYYY-MM-DD */
  date: string
  day: number
  isToday: boolean
  isSelected: boolean
  disabled: boolean
}

export interface DateGridProps {
  year: number
  /** 1-12 */
  month: number
  selected?: string
  onSelect?: (date: string) => void
  /** YYYY-MM-DD 边界(含端点) */
  min?: string
  max?: string
  /** B31 用:覆盖每格内容(默认仅渲染日期数字) */
  renderDay?: (meta: DayMeta) => React.ReactNode
  className?: string
}

export function DateGrid({
  year,
  month,
  selected,
  onSelect,
  min,
  max,
  renderDay,
  className,
}: DateGridProps) {
  const daysInMonth = new Date(year, month, 0).getDate()
  // getDay() 0=周日;转成周一为 0
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const today = todayYmd()

  // 当月日期格;前导空格用 null 占位补齐周一对齐
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const btnRefs = React.useRef<Map<number, HTMLButtonElement>>(new Map())

  const isDisabled = (date: string) =>
    (min !== undefined && date < min) || (max !== undefined && date > max)

  const focusDay = (day: number) => {
    const clamped = Math.min(Math.max(day, 1), daysInMonth)
    btnRefs.current.get(clamped)?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent, day: number) => {
    const delta =
      e.key === "ArrowLeft" ? -1 :
      e.key === "ArrowRight" ? 1 :
      e.key === "ArrowUp" ? -7 :
      e.key === "ArrowDown" ? 7 : 0
    if (delta !== 0) {
      e.preventDefault()
      focusDay(day + delta)
    }
  }

  // roving tabindex 落点:选中日 → 今日 → 1 号
  const rovingDay = (() => {
    const sel = parseYmd(selected)
    if (sel && sel.y === year && sel.m === month) return sel.d
    const t = parseYmd(today)
    if (t && t.y === year && t.m === month) return t.d
    return 1
  })()

  return (
    <div role="grid" aria-label={`${year} 年 ${month} 月`} className={cn("select-none", className)}>
      <div role="row" className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            role="columnheader"
            className="flex h-8 items-center justify-center text-[12px] font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} role="gridcell" aria-hidden />
          const date = ymd(year, month, day)
          const disabled = isDisabled(date)
          const isSel = date === selected
          const isToday = date === today
          const meta: DayMeta = { date, day, isToday, isSelected: isSel, disabled }
          return (
            <div role="gridcell" key={date} aria-selected={isSel}>
              <button
                type="button"
                ref={(el) => {
                  if (el) btnRefs.current.set(day, el)
                  else btnRefs.current.delete(day)
                }}
                tabIndex={day === rovingDay ? 0 : -1}
                disabled={disabled}
                onClick={() => !disabled && onSelect?.(date)}
                onKeyDown={(e) => onKeyDown(e, day)}
                aria-label={`${year} 年 ${month} 月 ${day} 日`}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "flex w-full flex-col items-center justify-center rounded-md text-[13px] transition-colors",
                  renderDay ? "min-h-16 p-1" : "h-9",
                  disabled
                    ? "cursor-not-allowed text-muted-foreground/40"
                    : "hover:bg-accent hover:text-accent-foreground",
                  isSel && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  !isSel && isToday && "ring-1 ring-inset ring-primary/50 font-semibold",
                )}
              >
                {renderDay ? renderDay(meta) : day}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

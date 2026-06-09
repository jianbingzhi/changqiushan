"use client"

import * as React from "react"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/lib/ui/popover"
import { DateGrid, parseYmd, todayYmd } from "@/lib/ui/date-grid"
import { formatCnDate } from "@/shared/format"
import { cn } from "@/lib/ui/utils"

// B27 中文日期选择器:可见 trigger 显示「2026 年 6 月 3 日」,popover 弹月历,
// 隐藏 input(name+YYYY-MM-DD)保持 GET 表单契约(替换原生 type=date 不破提交)。
export interface DatePickerProps {
  name: string
  defaultValue?: string
  value?: string
  onChange?: (date: string) => void
  id?: string
  required?: boolean
  min?: string
  max?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  name,
  defaultValue = "",
  value: controlled,
  onChange,
  id,
  required,
  min,
  max,
  placeholder = "选择日期",
  disabled,
  className,
}: DatePickerProps) {
  const isControlled = controlled !== undefined
  const [internal, setInternal] = React.useState(defaultValue)
  const selected = isControlled ? controlled : internal

  const [open, setOpen] = React.useState(false)

  // 视图月:跟随已选日期,否则今天
  const initView = parseYmd(selected) ?? parseYmd(todayYmd())!
  const [view, setView] = React.useState({ y: initView.y, m: initView.m })

  // 打开时把视图月对齐到已选日期(避免 effect 内 setState)
  const handleOpenChange = (next: boolean) => {
    if (next) {
      const v = parseYmd(selected)
      if (v) setView({ y: v.y, m: v.m })
    }
    setOpen(next)
  }

  const commit = (date: string) => {
    if (!isControlled) setInternal(date)
    onChange?.(date)
    setOpen(false)
  }

  const shiftMonth = (delta: number) => {
    setView((cur) => {
      const m0 = cur.m - 1 + delta
      return { y: cur.y + Math.floor(m0 / 12), m: ((m0 % 12) + 12) % 12 + 1 }
    })
  }

  return (
    <>
      <input type="hidden" name={name} value={selected} required={required} />
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={selected ? formatCnDate(selected) : placeholder}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              selected ? "text-foreground" : "text-muted-foreground",
              className,
            )}
          >
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {selected ? formatCnDate(selected) : placeholder}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="上个月"
              onClick={() => shiftMonth(-1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">{view.y} 年 {view.m} 月</span>
            <button
              type="button"
              aria-label="下个月"
              onClick={() => shiftMonth(1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <DateGrid
            year={view.y}
            month={view.m}
            selected={selected}
            onSelect={commit}
            min={min}
            max={max}
            className="w-64"
          />
          <div className="mt-2 flex items-center justify-between border-t pt-2">
            <button
              type="button"
              onClick={() => commit(todayYmd())}
              className="text-[12px] text-primary hover:underline"
            >
              今天
            </button>
            {selected && !required && (
              <button
                type="button"
                onClick={() => commit("")}
                className="text-[12px] text-muted-foreground hover:underline"
              >
                清除
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import { DatePicker } from "@/lib/ui/date-picker";
import { formatCnDate } from "@/shared/format";
import {
  saveTemplateAction,
  deleteTemplateAction,
  saveHolidayAction,
  deleteHolidayAction,
  type RuleActionResult,
  type TemplatePayload,
} from "./actions";

type DayType = "WEEKDAY" | "WEEKEND" | "HOLIDAY";

const DAY_TYPE_LABEL: Record<DayType, string> = {
  WEEKDAY: "工作日",
  WEEKEND: "周末",
  HOLIDAY: "节假日",
};
const DAY_TYPES: DayType[] = ["WEEKDAY", "WEEKEND", "HOLIDAY"];

export type TemplateRow = {
  id: string;
  dayType: DayType;
  name: string;
  startTime: string;
  endTime: string;
  miniProgramQuota: number;
  onsiteQuota: number;
  otaQuota: number;
  adminQuota: number;
  enabled: boolean;
};

export type HolidayRow = {
  date: string; // YYYY-MM-DD
  dayType: DayType;
  closed: boolean;
  note: string | null;
};

const QUOTA_FIELDS = [
  { key: "miniProgramQuota", label: "小程序" },
  { key: "onsiteQuota", label: "现场" },
  { key: "otaQuota", label: "第三方平台" },
  { key: "adminQuota", label: "后台" },
] as const;

const EMPTY_TEMPLATE = {
  id: undefined as string | undefined,
  dayType: "WEEKDAY" as DayType,
  name: "",
  startTime: "",
  endTime: "",
  miniProgramQuota: "",
  onsiteQuota: "",
  otaQuota: "",
  adminQuota: "",
  enabled: true,
};

const selectCls =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

function Msg({ msg }: { msg: RuleActionResult | null }) {
  if (!msg) return null;
  return (
    <p className={msg.ok ? "mt-3 text-[13px] text-success" : "mt-3 text-[13px] text-danger"}>
      {msg.message}
    </p>
  );
}

export function QuotaRules({
  templates,
  holidays,
}: {
  templates: TemplateRow[];
  holidays: HolidayRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [tplForm, setTplForm] = useState({ ...EMPTY_TEMPLATE });
  const [tplOpen, setTplOpen] = useState(false);
  const [tplMsg, setTplMsg] = useState<RuleActionResult | null>(null);

  const [holForm, setHolForm] = useState({ date: "", dayType: "HOLIDAY" as DayType, closed: false, note: "" });
  const [holMsg, setHolMsg] = useState<RuleActionResult | null>(null);

  function run(fn: () => Promise<RuleActionResult>, setMsg: (m: RuleActionResult) => void, onOk?: () => void) {
    startTransition(async () => {
      const res = await fn();
      setMsg(res);
      if (res.ok) {
        onOk?.();
        router.refresh();
      }
    });
  }

  function editTemplate(t: TemplateRow) {
    setTplForm({
      id: t.id,
      dayType: t.dayType,
      name: t.name,
      startTime: t.startTime,
      endTime: t.endTime,
      miniProgramQuota: String(t.miniProgramQuota),
      onsiteQuota: String(t.onsiteQuota),
      otaQuota: String(t.otaQuota),
      adminQuota: String(t.adminQuota),
      enabled: t.enabled,
    });
    setTplOpen(true);
    setTplMsg(null);
  }

  function submitTemplate() {
    const payload: TemplatePayload = {
      id: tplForm.id,
      dayType: tplForm.dayType,
      name: tplForm.name.trim(),
      startTime: tplForm.startTime,
      endTime: tplForm.endTime,
      miniProgramQuota: Number(tplForm.miniProgramQuota) || 0,
      onsiteQuota: Number(tplForm.onsiteQuota) || 0,
      otaQuota: Number(tplForm.otaQuota) || 0,
      adminQuota: Number(tplForm.adminQuota) || 0,
      enabled: tplForm.enabled,
    };
    run(() => saveTemplateAction(payload), setTplMsg, () => {
      setTplForm({ ...EMPTY_TEMPLATE });
      setTplOpen(false);
    });
  }

  function submitHoliday() {
    run(
      () =>
        saveHolidayAction({
          date: holForm.date,
          dayType: holForm.dayType,
          closed: holForm.closed,
          note: holForm.note.trim() || undefined,
        }),
      setHolMsg,
      () => setHolForm({ date: "", dayType: "HOLIDAY", closed: false, note: "" }),
    );
  }

  return (
    <div className="space-y-6">
      {/* 时段模板 */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">时段模板</h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setTplForm({ ...EMPTY_TEMPLATE });
                setTplOpen((v) => !v || tplForm.id != null);
                setTplMsg(null);
              }}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              新建模板
            </Button>
          </div>
        </div>
        <p className="mb-3 text-xs text-text-muted">
          按日期类型(工作日 / 周末 / 节假日)定义时段;各日期读取时按当日类型即时套用对应模板派生时段(首单自动落库),各渠道名额随模板带出。
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">日期类型</th>
                <th className="py-2 pr-3 font-medium">时段名</th>
                <th className="py-2 pr-3 font-medium">时间</th>
                <th className="py-2 pr-3 text-right font-medium">小程序</th>
                <th className="py-2 pr-3 text-right font-medium">现场</th>
                <th className="py-2 pr-3 text-right font-medium">第三方</th>
                <th className="py-2 pr-3 text-right font-medium">后台</th>
                <th className="py-2 pr-3 text-right font-medium">合计</th>
                <th className="py-2 pr-3 font-medium">状态</th>
                <th className="py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-text-muted">
                    暂无模板,点击「新建模板」开始配置
                  </td>
                </tr>
              ) : (
                templates.map((t) => {
                  const total = t.miniProgramQuota + t.onsiteQuota + t.otaQuota + t.adminQuota;
                  return (
                    <tr key={t.id} className="border-b border-border-light last:border-0">
                      <td className="py-2 pr-3">{DAY_TYPE_LABEL[t.dayType]}</td>
                      <td className="py-2 pr-3">{t.name}</td>
                      <td className="py-2 pr-3 tabular-nums">{t.startTime}–{t.endTime}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{t.miniProgramQuota}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{t.onsiteQuota}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{t.otaQuota}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{t.adminQuota}</td>
                      <td className="py-2 pr-3 text-right font-medium tabular-nums">{total}</td>
                      <td className="py-2 pr-3">
                        <span className={t.enabled ? "text-success" : "text-text-muted"}>
                          {t.enabled ? "启用" : "停用"}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => editTemplate(t)} className="h-7 gap-1 px-2">
                            <Pencil className="h-3.5 w-3.5" />
                            编辑
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => run(() => deleteTemplateAction(t.id), setTplMsg)}
                            className="h-7 gap-1 px-2 text-danger hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            删除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {tplOpen && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border-light pt-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <label htmlFor="tpl-daytype" className="text-xs text-muted-foreground">日期类型</label>
              <select
                id="tpl-daytype"
                className={selectCls}
                value={tplForm.dayType}
                onChange={(e) => setTplForm((f) => ({ ...f, dayType: e.target.value as DayType }))}
              >
                {DAY_TYPES.map((d) => (
                  <option key={d} value={d}>{DAY_TYPE_LABEL[d]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tpl-name" className="text-xs text-muted-foreground">时段名</label>
              <Input id="tpl-name" value={tplForm.name} maxLength={80} placeholder="如:上午场"
                onChange={(e) => setTplForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tpl-start" className="text-xs text-muted-foreground">开始时间</label>
              <Input id="tpl-start" type="time" value={tplForm.startTime}
                onChange={(e) => setTplForm((f) => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tpl-end" className="text-xs text-muted-foreground">结束时间</label>
              <Input id="tpl-end" type="time" value={tplForm.endTime}
                onChange={(e) => setTplForm((f) => ({ ...f, endTime: e.target.value }))} />
            </div>
            {QUOTA_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <label htmlFor={`tpl-${key}`} className="text-xs text-muted-foreground">{label}名额</label>
                <Input id={`tpl-${key}`} type="number" min={0} placeholder="0"
                  value={tplForm[key]}
                  onChange={(e) => setTplForm((f) => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <label className="col-span-2 flex items-center gap-2 text-[13px] text-foreground sm:col-span-4">
              <input type="checkbox" checked={tplForm.enabled}
                onChange={(e) => setTplForm((f) => ({ ...f, enabled: e.target.checked }))} />
              启用该模板(停用后对应日期类型不再派生该时段,已落库时段不受影响)
            </label>
            <div className="col-span-2 flex items-center gap-2 sm:col-span-4">
              <Button size="sm" disabled={pending} onClick={submitTemplate}>
                {pending ? "提交中…" : tplForm.id ? "保存修改" : "确认新建"}
              </Button>
              <Button size="sm" variant="outline" disabled={pending}
                onClick={() => { setTplForm({ ...EMPTY_TEMPLATE }); setTplOpen(false); }}>
                取消
              </Button>
            </div>
          </div>
        )}
        <Msg msg={tplMsg} />
      </section>

      {/* 特例日历 */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-1 text-[15px] font-semibold text-foreground">特例日历(调休 / 节假日 / 闭园)</h2>
        <p className="mb-3 text-xs text-text-muted">
          中国调休不可纯星期推算,需运营手录:指定某日的日期类型,或勾选「闭园」当日无任何可约时段。
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <label htmlFor="hol-date" className="text-xs text-muted-foreground">日期</label>
            <DatePicker id="hol-date" name="holDate" value={holForm.date}
              onChange={(date) => setHolForm((f) => ({ ...f, date }))} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="hol-daytype" className="text-xs text-muted-foreground">日期类型</label>
            <select id="hol-daytype" className={selectCls} value={holForm.dayType}
              onChange={(e) => setHolForm((f) => ({ ...f, dayType: e.target.value as DayType }))}>
              {DAY_TYPES.map((d) => <option key={d} value={d}>{DAY_TYPE_LABEL[d]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="hol-note" className="text-xs text-muted-foreground">备注</label>
            <Input id="hol-note" value={holForm.note} maxLength={80} placeholder="如:国庆调休"
              onChange={(e) => setHolForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
          <label className="flex items-end gap-2 pb-2.5 text-[13px] text-foreground">
            <input type="checkbox" checked={holForm.closed}
              onChange={(e) => setHolForm((f) => ({ ...f, closed: e.target.checked }))} />
            闭园日
          </label>
        </div>
        <div className="mt-3">
          <Button size="sm" disabled={pending || !holForm.date} onClick={submitHoliday}>
            {pending ? "提交中…" : "保存特例"}
          </Button>
        </div>
        <Msg msg={holMsg} />

        {holidays.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">日期</th>
                  <th className="py-2 pr-3 font-medium">类型</th>
                  <th className="py-2 pr-3 font-medium">闭园</th>
                  <th className="py-2 pr-3 font-medium">备注</th>
                  <th className="py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.date} className="border-b border-border-light last:border-0">
                    <td className="py-2 pr-3 tabular-nums">{formatCnDate(h.date)}</td>
                    <td className="py-2 pr-3">{DAY_TYPE_LABEL[h.dayType]}</td>
                    <td className="py-2 pr-3">{h.closed ? <span className="text-danger">闭园</span> : "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{h.note || "—"}</td>
                    <td className="py-2">
                      <Button size="sm" variant="ghost" disabled={pending}
                        onClick={() => run(() => deleteHolidayAction(h.date), setHolMsg)}
                        className="h-7 gap-1 px-2 text-danger hover:text-danger">
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

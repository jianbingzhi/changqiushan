"use client";

import { useState, useEffect } from "react";
import { Check, ChevronRight } from "lucide-react";
import { PageHeader } from "@/lib/ui/page-header";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import { DatePicker } from "@/lib/ui/date-picker";
import { cn } from "@/lib/ui/utils";
import { chinaToday, formatCnDate } from "@/shared/lib/time";
import { getOnsiteSlots, submitOnsiteBooking, type OnsiteSlotOption } from "./actions";

interface FormState {
  date: string;
  slotId: string;
  slotLabel: string;
  visitorName: string;
  phone: string;
  idCard: string;
  hasVehicle: boolean | null;
  plate: string;
  noVehicleDeclared: boolean;
}

const INITIAL: FormState = {
  date: chinaToday(),
  slotId: "",
  slotLabel: "",
  visitorName: "",
  phone: "",
  idCard: "",
  hasVehicle: null,
  plate: "",
  noVehicleDeclared: false,
};

const STEPS = ["选择时段", "游客信息", "车辆信息", "确认提交"];

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border-2",
                  done ? "bg-[#2D5A27] border-[#2D5A27] text-white" :
                  active ? "border-[#2D5A27] text-[#2D5A27] bg-white" :
                  "border-[#E5E7EB] text-[#9CA3AF] bg-white",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn("mt-1.5 text-xs whitespace-nowrap", active ? "text-[#2D5A27] font-semibold" : "text-[#9CA3AF]")}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-0.5 w-16 mx-1 mb-5", done ? "bg-[#2D5A27]" : "bg-[#E5E7EB]")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function validate(step: number, form: FormState): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  if (step === 0) {
    if (!form.date) errors.date = "请选择日期";
    if (!form.slotId) errors.slotLabel = "请选择时段";
  }
  if (step === 1) {
    if (!form.visitorName.trim()) errors.visitorName = "请填写姓名";
    if (!/^1[3-9]\d{9}$/.test(form.phone)) errors.phone = "手机号格式不正确";
    if (!/^\d{17}[\dXx]$/.test(form.idCard)) errors.idCard = "身份证号格式不正确";
  }
  if (step === 2) {
    if (form.hasVehicle === null) {
      errors.vehicle = "请选择有无车辆";
    } else if (form.hasVehicle && !form.plate.trim()) {
      errors.vehicle = "请填写车牌号";
    } else if (!form.hasVehicle && !form.noVehicleDeclared) {
      errors.vehicle = "请勾选「无车辆」声明以继续";
    }
  }
  return errors;
}

export default function OnsitePage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [slots, setSlots] = useState<OnsiteSlotOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 日期变化即拉取当日时段(联动选择器)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!form.date) { setSlots([]); return; }
      setLoadingSlots(true);
      try {
        const list = await getOnsiteSlots(form.date);
        if (!cancelled) setSlots(list);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [form.date]);

  function next() {
    const errs = validate(step, form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStep((s) => s + 1);
  }

  function back() {
    setErrors({});
    setStep((s) => s - 1);
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await submitOnsiteBooking({
      slotId: form.slotId,
      visitorName: form.visitorName,
      phone: form.phone,
      idCard: form.idCard,
      hasVehicle: form.hasVehicle === true,
      plate: form.plate,
      noVehicleDeclared: form.noVehicleDeclared,
    });
    setSubmitting(false);
    if (res.ok) setSubmitted(true);
    else setSubmitError(res.message);
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  if (submitted) {
    return (
      <div className="max-w-xl">
        <PageHeader title="现场补录面板" description="现场快速录入预约信息" />
        <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2D5A27]">
            <Check className="h-6 w-6 text-white" />
          </div>
          <p className="text-[#1F2937] font-semibold text-lg">预约单已提交</p>
          <p className="text-[13px] text-[#6B7280]">游客 {form.visitorName} 的预约信息已成功录入系统</p>
          <Button onClick={() => { setForm(INITIAL); setStep(0); setSubmitted(false); setSubmitError(null); }}>
            继续录入
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="现场补录面板" description="现场快速录入预约信息" />

      <div className="mb-8"><StepIndicator current={step} /></div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 space-y-5">
        <h2 className="text-base font-semibold text-[#1F2937] flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2D5A27] text-white text-xs font-bold">{step + 1}</span>
          {STEPS[step]}
        </h2>

        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#1F2937]">预约日期</label>
              <DatePicker
                name="onsiteDate"
                value={form.date}
                onChange={(date) => setForm((f) => ({ ...f, date, slotId: "", slotLabel: "" }))}
                className="max-w-xs"
              />
              {errors.date && <p className="text-[12px] text-[#DC2626]">{errors.date}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#1F2937]">时段</label>
              <select
                value={form.slotId}
                onChange={(e) => {
                  const opt = slots.find((s) => s.id === e.target.value);
                  setForm((f) => ({ ...f, slotId: e.target.value, slotLabel: opt?.label ?? "" }));
                }}
                disabled={loadingSlots || slots.length === 0}
                className="max-w-xs w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]"
              >
                <option value="">
                  {loadingSlots ? "加载时段中…" : slots.length === 0 ? "当日暂无可预约时段" : "请选择时段"}
                </option>
                {slots.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.soldOut}>
                    {s.label}{s.soldOut ? "（已满）" : ""}
                  </option>
                ))}
              </select>
              {errors.slotLabel && <p className="text-[12px] text-[#DC2626]">{errors.slotLabel}</p>}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {(["visitorName", "phone", "idCard"] as const).map((field) => (
              <div key={field} className="space-y-1.5">
                <label className="text-sm font-medium text-[#1F2937]">
                  {field === "visitorName" ? "姓名" : field === "phone" ? "手机号" : "身份证号"}
                </label>
                <Input
                  value={form[field]}
                  onChange={(e) => set(field, e.target.value)}
                  placeholder={field === "visitorName" ? "请输入真实姓名" : field === "phone" ? "11 位手机号" : "18 位居民身份证"}
                  maxLength={field === "idCard" ? 18 : field === "phone" ? 11 : 40}
                  className={cn("max-w-xs", errors[field] && "border-[#DC2626]")}
                />
                {errors[field] && <p className="text-[12px] text-[#DC2626]">{errors[field]}</p>}
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <p className="text-sm font-medium text-[#1F2937]">车辆情况</p>
            <div className="flex gap-3">
              {[{ v: true, label: "有车辆" }, { v: false, label: "无车辆" }].map(({ v, label }) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, hasVehicle: v, plate: "", noVehicleDeclared: false }))}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                    form.hasVehicle === v
                      ? "border-[#2D5A27] bg-[#F0FDF4] text-[#2D5A27]"
                      : "border-[#E5E7EB] text-[#6B7280] hover:border-[#2D5A27]/40",
                  )}
                >
                  {form.hasVehicle === v && <Check className="h-4 w-4" />}
                  {label}
                </button>
              ))}
            </div>
            {form.hasVehicle === true && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#1F2937]">车牌号</label>
                <Input
                  placeholder="如：川A12345"
                  value={form.plate}
                  onChange={(e) => set("plate", e.target.value.toUpperCase())}
                  maxLength={10}
                  className="max-w-xs"
                />
              </div>
            )}
            {form.hasVehicle === false && (
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.noVehicleDeclared}
                  onChange={(e) => set("noVehicleDeclared", e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#2D5A27]"
                />
                <span className="text-sm text-[#1F2937]">本人确认无自驾车辆入园，知悉相关规定</span>
              </label>
            )}
            {errors.vehicle && <p className="text-[12px] text-[#DC2626]">{errors.vehicle}</p>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-[#6B7280]">请核对以下信息后提交</p>
            <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 divide-y divide-[#F3F4F6]">
              {[
                ["预约日期", formatCnDate(form.date)],
                ["时段", form.slotLabel],
                ["姓名", form.visitorName],
                ["手机号", form.phone],
                ["身份证号", form.idCard.length === 18 ? `${form.idCard.slice(0, 4)}**********${form.idCard.slice(-4)}` : form.idCard],
                ["车牌号", form.hasVehicle ? form.plate : form.noVehicleDeclared ? "无车辆（已声明）" : "—"],
                ["录入渠道", "现场补录"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center py-2.5 gap-6">
                  <span className="w-24 shrink-0 text-[13px] text-[#6B7280]">{k}</span>
                  <span className="text-[13px] text-[#1F2937] font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {submitError && step === STEPS.length - 1 && (
          <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#DC2626]">
            {submitError}
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={back} disabled={step === 0 || submitting}>上一步</Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} className="gap-1">
              下一步 <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "提交中…" : "确认提交"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui/button";
import { reviewSignupAction } from "./actions";

export function ReviewButtons({ activityId, signupId }: { activityId: string; signupId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(decision: "APPROVED" | "REJECTED") {
    setMsg(null);
    startTransition(async () => {
      const res = await reviewSignupAction(activityId, signupId, decision);
      setMsg(res.message);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <Button size="sm" className="text-[12px]" disabled={pending} onClick={() => run("APPROVED")}>通过</Button>
        <Button size="sm" variant="outline" className="text-[12px] text-danger border-[#FECACA]" disabled={pending} onClick={() => run("REJECTED")}>驳回</Button>
      </div>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}

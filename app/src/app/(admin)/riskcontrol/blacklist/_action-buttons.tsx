"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui/button";
import { reviewAppealAction, removeBlacklistAction } from "./actions";

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  };
  return { pending, error, run };
}

export function RemoveBlacklistButton({ userId }: { userId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => removeBlacklistAction(userId))}
        className="text-[12px] text-[#DC2626] border-[#FECACA]"
      >
        {pending ? "处理中…" : "移除"}
      </Button>
      {error && <span className="text-[11px] text-[#DC2626]">{error}</span>}
    </div>
  );
}

export function ReviewAppealButtons({ appealId }: { appealId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => reviewAppealAction(appealId, "APPROVED"))}
          style={{ backgroundColor: "#2D5A27", color: "#fff" }}
          className="text-[12px]"
        >
          通过
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => reviewAppealAction(appealId, "REJECTED"))}
          className="text-[12px]"
        >
          驳回
        </Button>
      </div>
      {error && <span className="text-[11px] text-[#DC2626]">{error}</span>}
    </div>
  );
}

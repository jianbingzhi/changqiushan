"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui/button";
import { checkinBooking } from "./actions";

export function CheckinButton({ qrCode }: { qrCode: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await checkinBooking(qrCode);
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={onClick}
        className="text-[12px]"
      >
        {pending ? "核销中…" : "核销"}
      </Button>
      {error && <span className="text-xs text-[#DC2626]">{error}</span>}
    </div>
  );
}

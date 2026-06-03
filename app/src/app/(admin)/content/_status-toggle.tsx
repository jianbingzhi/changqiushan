"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui/button";
import { publishContentAction, archiveContentAction, type ContentModel } from "./_actions";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface Props {
  model: ContentModel;
  id: string;
  status: Status;
  revalidate: string;
  /** 文案风格:default=发布/下线;toggle=启用/停用(知识库) */
  variant?: "default" | "toggle";
}

export function StatusToggle({ model, id, status, revalidate, variant = "default" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const publishLabel = variant === "toggle" ? "启用" : "发布";
  const archiveLabel = variant === "toggle" ? "停用" : "下线";

  function act(fn: () => Promise<{ ok: boolean; message: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  }

  if (status === "ARCHIVED") {
    return <span className="text-[12px] text-[#9CA3AF]">已下线</span>;
  }

  const isDraft = status === "DRAFT";
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant={isDraft ? "default" : "outline"}
        disabled={pending}
        onClick={() =>
          act(() =>
            isDraft
              ? publishContentAction(model, id, revalidate)
              : archiveContentAction(model, id, revalidate),
          )
        }
        className="text-[12px]"
       
      >
        {pending ? "处理中…" : isDraft ? publishLabel : archiveLabel}
      </Button>
      {error && <span className="text-xs text-[#DC2626]">{error}</span>}
    </div>
  );
}

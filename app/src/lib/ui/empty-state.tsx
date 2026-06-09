import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ message = "暂无数据", action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Inbox className="w-10 h-10 text-text-muted" />
      <p className="text-[13px] text-muted-foreground">{message}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

import type { ReactNode } from "react";
import { Breadcrumb } from "@/lib/ui/breadcrumb";

interface PageHeaderProps {
  /** 标题可选:首页等无需重复标题的页可不传 */
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <Breadcrumb />
      <div className="flex items-start justify-between gap-4">
        <div>
          {title && <h1 className="text-xl font-bold leading-tight text-[#1F2937]">{title}</h1>}
          {description && (
            <p className="mt-1 text-[13px] text-[#6B7280]">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

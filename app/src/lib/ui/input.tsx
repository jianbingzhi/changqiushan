import * as React from "react"

import { cn } from "@/lib/ui/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  /** 前置图标(如 lucide <User/>);自动包 relative 容器并留出左内边距。 */
  startIcon?: React.ReactNode
}

const baseInput =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, startIcon, ...props }, ref) => {
    if (startIcon) {
      return (
        <div className="relative w-full">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
            {startIcon}
          </span>
          <input
            type={type}
            className={cn(baseInput, "pl-9", className)}
            ref={ref}
            {...props}
          />
        </div>
      )
    }
    return (
      <input type={type} className={cn(baseInput, className)} ref={ref} {...props} />
    )
  }
)
Input.displayName = "Input"

export { Input }

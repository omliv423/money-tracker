import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, style, ...props }: React.ComponentProps<"input">) {
  const isDateType = type === "date" || type === "datetime-local" || type === "time";

  if (isDateType) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl">
        <input
          type={type}
          data-slot="input"
          className={cn(
            "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input w-full border bg-card text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:border-primary focus-visible:ring-primary/30 focus-visible:ring-[3px] focus-visible:shadow-glow",
            "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
            "h-11 rounded-2xl px-4 py-2",
            className
          )}
          style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", ...style }}
          {...props}
        />
      </div>
    )
  }

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input w-full min-w-0 border bg-card py-2 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-primary focus-visible:ring-primary/30 focus-visible:ring-[3px] focus-visible:shadow-glow",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        "h-11 rounded-2xl px-4",
        className
      )}
      style={style}
      {...props}
    />
  )
}

export { Input }

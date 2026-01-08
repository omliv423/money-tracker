"use client"

import * as React from "react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: Date | null
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = "日付を選択",
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    // Check if mobile on mount and on resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const handleSelect = (date: Date | undefined) => {
    onChange?.(date)
    setOpen(false)
  }

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = e.target.value
    if (dateStr) {
      // Parse as local date (not UTC)
      const [year, month, day] = dateStr.split("-").map(Number)
      const date = new Date(year, month - 1, day)
      onChange?.(date)
    } else {
      onChange?.(undefined)
    }
  }

  // Format date for native input (yyyy-MM-dd)
  const nativeValue = value
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
    : ""

  // Mobile: use native date input
  if (isMobile) {
    return (
      <div className={cn("relative", className)}>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <input
          type="date"
          value={nativeValue}
          onChange={handleNativeChange}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        />
      </div>
    )
  }

  // Desktop: use Popover + Calendar
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "yyyy年M月d日", { locale: ja }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import * as React from "react"
import { DayPicker } from "react-day-picker"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-slate-900 rounded-xl shadow-2xl border border-slate-700", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-black uppercase text-white",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent border-slate-700 p-0 text-slate-300 hover:bg-slate-800 hover:text-white absolute left-1 transition-colors"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent border-slate-700 p-0 text-slate-300 hover:bg-slate-800 hover:text-white absolute right-1 transition-colors"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full",
        weekday: "text-slate-400 rounded-md w-full font-black text-[0.7rem] text-center uppercase",
        weeks: "w-full space-y-2 mt-2",
        week: "flex w-full mt-2",
        day: "h-9 w-full text-center text-sm p-0 relative flex items-center justify-center focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-bold text-white hover:bg-slate-700 hover:text-white transition-colors"
        ),
        selected: "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white focus:bg-emerald-500 focus:text-white rounded-lg shadow-md opacity-100",
        today: "bg-slate-800 text-emerald-400 font-black",
        outside: "text-slate-600 opacity-50",
        disabled: "text-slate-600 opacity-50",
        range_middle: "aria-selected:bg-slate-800 aria-selected:text-white",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ ...props }) => {
          return props.orientation === 'left' ? <ChevronLeft size={16} className="text-white" /> : <ChevronRight size={16} className="text-white" />;
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

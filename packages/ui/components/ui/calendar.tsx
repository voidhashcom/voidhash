"use client";
import type * as React from "react";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      className={cn(
        "group/calendar bg-background p-2 [--cell-radius:var(--radius-md)] [--cell-size:1.75rem]",
        className,
      )}
      classNames={{
        vhidden: "sr-only",
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex w-full flex-col gap-4",
        caption: "relative flex h-(--cell-size) w-full items-center justify-center",
        caption_dropdowns:
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 px-(--cell-size) font-medium text-sm",
        caption_label:
          "flex items-center gap-1 rounded-(--cell-radius) font-medium text-sm select-none [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
        dropdown_month: "relative rounded-(--cell-radius)",
        dropdown_year: "relative rounded-(--cell-radius)",
        dropdown:
          "absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:pointer-events-none disabled:opacity-0",
        dropdown_icon: "ml-1 size-3.5 text-muted-foreground",
        nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "size-(--cell-size) bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell:
          "flex-1 rounded-(--cell-radius) font-normal text-[0.8rem] text-muted-foreground select-none",
        row: "flex w-full mt-2",
        cell: cn(
          "relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center text-sm select-none focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-range-end)]:rounded-r-(--cell-radius)",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-(--cell-radius) [&:has(>.day-range-start)]:rounded-l-(--cell-radius) first:[&:has([aria-selected])]:rounded-l-(--cell-radius) last:[&:has([aria-selected])]:rounded-r-(--cell-radius)"
            : "[&:has([aria-selected])]:rounded-(--cell-radius)",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "relative z-10 size-(--cell-size) min-w-(--cell-size) border-0 p-0 font-normal leading-none aria-selected:opacity-100",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside: "day-outside text-muted-foreground aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconDropdown: ({ className, ...props }) => (
          <ChevronDown className={cn("size-3.5", className)} {...props} />
        ),
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("size-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("size-4", className)} {...props} />
        ),
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}

export { Calendar };

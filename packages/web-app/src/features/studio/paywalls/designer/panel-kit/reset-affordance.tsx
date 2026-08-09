"use client";

import { cn } from "@voidhash/ui";
import { Undo2Icon } from "lucide-react";

interface OverrideResetAffordanceProps {
  show: boolean;
  label: string;
  onReset: () => void;
  children: React.ReactNode;
  className?: string;
}

export function OverrideResetAffordance({
  show,
  label,
  onReset,
  children,
  className,
}: OverrideResetAffordanceProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {show && (
        <button
          aria-label={`Reset ${label} override`}
          className={cn(
            "group/reset-button absolute right-0 bottom-0 z-10 inline-flex origin-right translate-x-[6px] translate-y-[6px] items-center justify-center overflow-hidden whitespace-nowrap rounded-full bg-transparent text-transparent outline-none transition-all duration-200 ease-out",
            "h-3 w-3 p-0",
            "hover:h-6 hover:w-20 hover:bg-primary hover:px-2 hover:text-primary-foreground hover:shadow-sm",
            "focus-visible:h-6 focus-visible:w-20 focus-visible:bg-primary focus-visible:px-2 focus-visible:text-primary-foreground focus-visible:shadow-sm focus-visible:ring-1 focus-visible:ring-ring",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onReset();
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          type="button"
        >
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute h-2 w-2 rounded-full bg-primary transition-opacity duration-150",
              "group-hover/reset-button:opacity-0 group-focus-visible/reset-button:opacity-0",
            )}
          />
          <span
            className={cn(
              "pointer-events-none inline-flex items-center gap-1 opacity-0 transition-opacity duration-150",
              "group-hover/reset-button:opacity-100 group-focus-visible/reset-button:opacity-100",
            )}
          >
            <span className="font-medium text-[11px]">Reset</span>
            <Undo2Icon className="size-3" />
          </span>
        </button>
      )}
    </div>
  );
}

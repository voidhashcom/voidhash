"use client";

import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@voidhash/ui";
import { CheckIcon, CircleDashedIcon, CircleDotDashedIcon, TriangleAlertIcon } from "lucide-react";

export type PaymentProviderDetailTabStatus = "valid" | "invalid" | "untouched" | "optional";

export interface PaymentProviderDetailTab {
  id: string;
  label: string;
  status: PaymentProviderDetailTabStatus;
  message?: string;
}

/**
 * Vertical tab navigation for the payment provider detail page. Styled to match
 * the app sidebar menu, with a per-tab validation indicator and dotted
 * connectors linking the status icons into a checklist-style rail.
 */
export function PaymentProviderDetailTabNav({
  tabs,
  activeTabId,
  onTabChange,
  className,
}: {
  tabs: PaymentProviderDetailTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-col gap-1.5", className)}>
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const isLast = index === tabs.length - 1;

        return (
          <div className="relative" key={tab.id}>
            <button
              className={cn(
                "flex h-9 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left text-muted-foreground text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
              onClick={() => onTabChange(tab.id)}
              type="button"
            >
              <TabStatus status={tab.status} message={tab.message} />
              <span className="truncate">{tab.label}</span>
            </button>
            {/*
              Dotted connector linking this tab's status icon to the next one.
              Offsets are derived from the fixed row metrics: px-2 (8px) + half
              the size-5 icon (10px) = 18px horizontal center; the icon bottom
              sits 28px (top-7) from the row top and the next icon top is 22px
              below that (8px to row end + 6px gap + 8px into the next row).
            */}
            {isLast ? null : (
              <span
                aria-hidden
                className="-translate-x-1/2 pointer-events-none absolute top-7 left-[18px] h-[22px] border-border border-l border-dashed"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function TabStatus({
  message,
  status,
}: {
  message?: string;
  status: PaymentProviderDetailTabStatus;
}) {
  const icon = <TabStatusIcon status={status} />;

  if (!message) {
    return icon;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label={message} className="inline-flex">
          {icon}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{message}</TooltipContent>
    </Tooltip>
  );
}

function TabStatusIcon({ status }: { status: PaymentProviderDetailTabStatus }) {
  if (status === "valid") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary">
        <CheckIcon className="size-3 text-primary-foreground" strokeWidth={3} />
      </span>
    );
  }

  if (status === "invalid") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blaze-orange-500">
        <TriangleAlertIcon className="size-3 text-black" />
      </span>
    );
  }

  if (status === "optional") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CircleDotDashedIcon className="size-3.5" />
      </span>
    );
  }

  return <CircleDashedIcon className="size-5 shrink-0 text-muted-foreground/40" />;
}

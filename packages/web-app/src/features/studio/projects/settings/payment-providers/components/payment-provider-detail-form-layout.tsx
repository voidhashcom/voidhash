"use client";

import { cn } from "@voidhash/ui";
import type { ReactNode } from "react";

import {
  type PaymentProviderDetailTab,
  PaymentProviderDetailTabNav,
} from "./payment-provider-detail-tab-nav";

export function PaymentProviderDetailFormLayout({
  activeTabId,
  children,
  className,
  onTabChange,
  tabs,
}: {
  activeTabId: string;
  children: ReactNode;
  className?: string;
  onTabChange: (tabId: string) => void;
  tabs: PaymentProviderDetailTab[];
}) {
  return (
    <div className={cn("mx-auto flex w-full max-w-5xl flex-1 gap-20 px-6 py-8 pt-20", className)}>
      <PaymentProviderDetailTabNav
        activeTabId={activeTabId}
        className="w-56 shrink-0"
        onTabChange={onTabChange}
        tabs={tabs}
      />

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

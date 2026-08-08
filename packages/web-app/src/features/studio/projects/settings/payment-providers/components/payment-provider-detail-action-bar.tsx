import { cn } from "@voidhash/ui";
import type { ReactNode } from "react";

/**
 * Floating, sticky action bar pinned to the bottom of the payment provider
 * detail page. Holds page-level actions such as "Save Changes". The gradient
 * wrapper masks page content scrolling underneath the bar.
 */
export function PaymentProviderDetailActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 bg-background px-6 pt-6 pb-6 flex items-center justify-center">
      <div
        className={cn(
          "mx-auto flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card px-2 py-2 shadow-lg",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

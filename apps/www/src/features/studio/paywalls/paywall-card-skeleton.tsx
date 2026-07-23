import { Phone, Skeleton } from "@voidhash/ui";

/** Loading placeholder matching the paywall card's thumbnail geometry. */
export function PaywallCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex aspect-[246/278] items-center justify-center bg-muted/30">
        <Phone className="h-[86.34%]" fitHeight screenClassName="animate-pulse bg-muted" />
      </div>
      <div className="px-4 py-3.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-1.5 h-3 w-1/2" />
      </div>
    </div>
  );
}

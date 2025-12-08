import { Skeleton } from '@voidhash/ui';

export function PaywallCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <Skeleton className="aspect-3/4 w-full rounded-none" />
      <div className="border-t p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
      </div>
    </div>
  );
}

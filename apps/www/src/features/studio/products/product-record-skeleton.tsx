"use client";

import { Skeleton } from "@voidhash/ui";

export function ProductRecordSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="size-2 rounded-full" />
    </div>
  );
}

"use client";

import { Skeleton } from "@voidhash/ui";

export function FlagRecordSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

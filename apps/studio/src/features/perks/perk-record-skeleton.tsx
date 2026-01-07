"use client";

import { Skeleton } from "@voidhash/ui";

export function PerkRecordSkeleton() {
  return (
    <div className="group relative isolate px-6 py-4 hover:bg-accent/30">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-1 items-start gap-4">
          <div className="w-42">
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

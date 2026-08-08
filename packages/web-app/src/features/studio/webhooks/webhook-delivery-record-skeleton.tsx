import { Skeleton } from "@voidhash/ui";

export function WebhookDeliveryRecordSkeleton() {
  return (
    <div className="px-6 py-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-1 items-start gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

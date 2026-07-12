import { Skeleton } from "@voidhash/ui";

export function WebhookEndpointRecordSkeleton() {
  return (
    <div className="px-6 py-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-1 items-start gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
    </div>
  );
}

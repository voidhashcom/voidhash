"use client";

import type { WebhookDeliveryWithAttempts } from "@voidhash/rpc";
import { format } from "date-fns";
import { CalendarIcon, Clock4Icon, HashIcon, RefreshCwIcon } from "lucide-react";

interface WebhookDeliverySidebarProps {
  delivery: typeof WebhookDeliveryWithAttempts.Type;
}

export function WebhookDeliverySidebar({ delivery }: WebhookDeliverySidebarProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-xl">Details</h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="font-semibold text-sm">Attempts</p>
            <div className="mt-1 flex items-center gap-2">
              <HashIcon className="h-4 w-4 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                {delivery.attemptCount} attempt
                {delivery.attemptCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {delivery.nextAttemptAt && (
            <div>
              <p className="font-semibold text-sm">Next Retry</p>
              <div className="mt-1 flex items-center gap-2">
                <RefreshCwIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  {format(delivery.nextAttemptAt, "MMM d, yyyy HH:mm")}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="font-semibold text-sm">Event Occurred</p>
            <div className="mt-1 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                {format(delivery.eventOccurredAt, "MMM d, yyyy HH:mm:ss")}
              </p>
            </div>
          </div>

          {delivery.completedAt && (
            <div>
              <p className="font-semibold text-sm">Completed</p>
              <div className="mt-1 flex items-center gap-2">
                <Clock4Icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  {format(delivery.completedAt, "MMM d, yyyy HH:mm:ss")}
                </p>
              </div>
            </div>
          )}

          {delivery.createdAt && (
            <div>
              <p className="font-semibold text-sm">Created</p>
              <div className="mt-1 flex items-center gap-2">
                <Clock4Icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  {format(delivery.createdAt, "MMM d, yyyy HH:mm:ss")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

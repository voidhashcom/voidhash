"use client";

import type { WebhookDelivery } from "@voidhash/rpc";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ChevronRightIcon } from "lucide-react";

import { getEventLabel } from "./webhook-event-types";
import { WebhookStatusBadge } from "./webhook-status-badge";

interface WebhookDeliveryRecordProps {
  delivery: typeof WebhookDelivery.Type;
  endpointId: string;
  organizationSlug: string;
  projectSlug: string;
}

export function WebhookDeliveryRecord({
  delivery,
  endpointId,
  organizationSlug,
  projectSlug,
}: WebhookDeliveryRecordProps) {
  return (
    <div className="group relative isolate px-6 py-4 hover:bg-accent/30">
      <Link
        className="absolute inset-0 h-full w-full"
        params={{
          deliveryId: delivery.id,
          endpointId,
          organizationSlug,
          projectSlug,
        }}
        to="/studio/$organizationSlug/$projectSlug/settings/webhooks/$endpointId/$deliveryId"
      />
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-1 items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{getEventLabel(delivery.eventType)}</p>
            <p className="mt-1 text-muted-foreground text-sm">
              {formatDistanceToNow(delivery.eventOccurredAt, {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {delivery.attemptCount} attempt
            {delivery.attemptCount !== 1 ? "s" : ""}
          </span>
          <WebhookStatusBadge status={delivery.status} />
          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

"use client";

import type { WebhookEndpoint } from "@voidhash/rpc";
import { Button } from "@voidhash/ui";
import { format } from "date-fns";
import { Clock4Icon, CopyIcon, LinkIcon, ZapIcon } from "lucide-react";
import { toast } from "sonner";

import { getEventLabel } from "./webhook-event-types";

interface WebhookEndpointDetailSidebarProps {
  endpoint: typeof WebhookEndpoint.Type;
}

export function WebhookEndpointDetailSidebar({ endpoint }: WebhookEndpointDetailSidebarProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-xl">Details</h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="font-semibold text-sm">URL</p>
            <div className="mt-1 flex items-center gap-2">
              <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="truncate text-muted-foreground text-sm">{endpoint.url}</p>
              <Button
                className="shrink-0"
                onClick={() => copyToClipboard(endpoint.url, "URL")}
                size="icon"
                variant="ghost"
              >
                <CopyIcon className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div>
            <p className="font-semibold text-sm">Events</p>
            <div className="mt-1 flex items-start gap-2">
              <ZapIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="text-muted-foreground text-sm">
                {endpoint.events.map((event) => (
                  <p key={event}>{getEventLabel(event)}</p>
                ))}
              </div>
            </div>
          </div>

          {endpoint.consecutiveFailures > 0 && (
            <div>
              <p className="font-semibold text-sm">Consecutive Failures</p>
              <p className="mt-1 text-destructive text-sm">{endpoint.consecutiveFailures}</p>
            </div>
          )}

          {endpoint.lastSuccessAt && (
            <div>
              <p className="font-semibold text-sm">Last Success</p>
              <div className="mt-1 flex items-center gap-2">
                <Clock4Icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  {format(endpoint.lastSuccessAt, "MMM d, yyyy HH:mm")}
                </p>
              </div>
            </div>
          )}

          {endpoint.createdAt && (
            <div>
              <p className="font-semibold text-sm">Created</p>
              <div className="mt-1 flex items-center gap-2">
                <Clock4Icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  {format(endpoint.createdAt, "MMM d, yyyy")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-xl">Secret</h2>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-sm">
            {endpoint.secret.slice(0, 20)}...
          </code>
          <Button
            onClick={() => copyToClipboard(endpoint.secret, "Secret")}
            size="icon"
            variant="ghost"
          >
            <CopyIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

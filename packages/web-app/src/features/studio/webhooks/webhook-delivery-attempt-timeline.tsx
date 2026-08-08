"use client";

import type { WebhookDeliveryAttempt } from "@voidhash/rpc";
import {
  Badge,
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@voidhash/ui";
import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";

interface WebhookDeliveryAttemptTimelineProps {
  attempts: (typeof WebhookDeliveryAttempt.Type)[];
}

export function WebhookDeliveryAttemptTimeline({ attempts }: WebhookDeliveryAttemptTimelineProps) {
  // Sort by attempt number descending (most recent first)
  const sortedAttempts = [...attempts].sort((a, b) => b.attemptNumber - a.attemptNumber);

  if (sortedAttempts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-6">
        <div className="text-muted-foreground">No delivery attempts yet.</div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {sortedAttempts.map((attempt, index) => (
        <Collapsible key={attempt.id}>
          <div className="relative pl-6">
            {/* Timeline connector */}
            {index < sortedAttempts.length - 1 && (
              <div className="absolute top-6 bottom-0 left-[7px] w-px bg-border" />
            )}

            {/* Status indicator dot */}
            <div
              className={cn(
                "absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 bg-background",
                attempt.succeeded ? "border-green-500" : "border-destructive",
              )}
            />

            {/* Attempt content */}
            <CollapsibleTrigger className="flex w-full items-center justify-between py-3 text-left hover:bg-accent/30 -ml-6 pl-6 pr-4 rounded-md">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Attempt #{attempt.attemptNumber}</p>
                  {attempt.succeeded ? (
                    <Badge variant="default">Success</Badge>
                  ) : (
                    <Badge variant="destructive">Failed</Badge>
                  )}
                </div>
                <p className="mt-1 text-muted-foreground text-sm">
                  {attempt.createdAt
                    ? format(attempt.createdAt, "MMM d, yyyy HH:mm:ss")
                    : "Unknown time"}
                  {attempt.durationMs && ` - ${attempt.durationMs}ms`}
                </p>
              </div>
              <ChevronDownIcon className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-2 mb-4 ml-0 rounded-md bg-muted p-3 text-sm">
              {attempt.statusCode && (
                <p>
                  <strong>Status Code:</strong> {attempt.statusCode}
                </p>
              )}
              {attempt.errorMessage && (
                <p className="mt-1">
                  <strong>Error:</strong> {attempt.errorMessage}
                </p>
              )}
              {attempt.responseBody && (
                <div className="mt-2">
                  <p>
                    <strong>Response:</strong>
                  </p>
                  <pre className="mt-1 overflow-auto whitespace-pre-wrap text-xs">
                    {attempt.responseBody}
                  </pre>
                </div>
              )}
              {!attempt.statusCode && !attempt.errorMessage && !attempt.responseBody && (
                <p className="text-muted-foreground">No additional details available.</p>
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );
}

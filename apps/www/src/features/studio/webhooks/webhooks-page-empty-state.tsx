"use client";

import { Card } from "@voidhash/ui";
import { WebhookIcon } from "lucide-react";

import { CreateWebhookModalButton } from "./create-webhook-modal-button";

interface WebhooksPageEmptyStateProps {
  projectId: string;
}

export function WebhooksPageEmptyState({ projectId }: WebhooksPageEmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <WebhookIcon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-medium text-lg">No webhooks configured</h3>
      <p className="mt-2 max-w-sm text-muted-foreground text-sm">
        Webhooks allow you to receive real-time notifications when events occur in your project.
      </p>
      <div className="mt-6">
        <CreateWebhookModalButton projectId={projectId} />
      </div>
    </Card>
  );
}

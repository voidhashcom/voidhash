"use client";

import type { WebhookEndpointWithSecret } from "@voidhash/rpc";
import { Button } from "@voidhash/ui";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { CreateWebhookModal } from "./create-webhook-modal";
import { WebhookSecretRevealModal } from "./webhook-secret-reveal-modal";

interface CreateWebhookModalButtonProps {
  projectId: string;
}

export function CreateWebhookModalButton({ projectId }: CreateWebhookModalButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [createdWebhook, setCreatedWebhook] = useState<
    typeof WebhookEndpointWithSecret.Type | null
  >(null);

  const handleSuccess = (webhook: typeof WebhookEndpointWithSecret.Type) => {
    setCreatedWebhook(webhook);
  };

  return (
    <>
      <CreateWebhookModal
        onClose={() => setIsOpen(false)}
        onSuccess={handleSuccess}
        open={isOpen}
        projectId={projectId}
        trigger={
          <Button onClick={() => setIsOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Webhook
          </Button>
        }
      />
      <WebhookSecretRevealModal
        onClose={() => setCreatedWebhook(null)}
        open={!!createdWebhook}
        secret={createdWebhook?.secret ?? null}
      />
    </>
  );
}

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WebhookEndpoint } from "@voidhash/rpc";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useConfirmDialog,
} from "@voidhash/ui";
import { EllipsisVerticalIcon, PencilIcon, RefreshCwIcon, SendIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteWebhookEndpointOptions,
  queryKeys,
  rotateWebhookSecretOptions,
  testWebhookEndpointOptions,
} from "@/features/studio/lib/tanstack-query";

import { EditWebhookModal } from "./edit-webhook-modal";
import { WebhookSecretRevealModal } from "./webhook-secret-reveal-modal";

interface WebhookEndpointActionsDropdownProps {
  webhook: typeof WebhookEndpoint.Type;
  projectId: string;
  onDeleted?: () => void;
}

export function WebhookEndpointActionsDropdown({
  webhook,
  projectId,
  onDeleted,
}: WebhookEndpointActionsDropdownProps) {
  const queryClient = useQueryClient();
  const { ConfirmationDialog, openDialog } = useConfirmDialog();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [revealSecret, setRevealSecret] = useState<string | null>(null);

  // Delete webhook
  const { mutate: deleteWebhook, status: deleteWebhookStatus } = useMutation({
    ...deleteWebhookEndpointOptions(),
    onError: () => {
      toast.error("Failed to delete webhook");
    },
    onSuccess: () => {
      toast.success("Webhook deleted successfully");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.webhook.list({ projectId }),
      });
      onDeleted?.();
    },
  });

  const handleDelete = async () => {
    const res = await openDialog({
      confirmText: "Delete",
      description: "Are you sure you want to delete this webhook? This action cannot be undone.",
      title: "Delete webhook",
    });
    if (res) {
      deleteWebhook({ endpointId: webhook.id });
    }
  };

  // Rotate secret
  const { mutate: rotateSecret, status: rotateSecretStatus } = useMutation({
    ...rotateWebhookSecretOptions(),
    onError: () => {
      toast.error("Failed to rotate secret");
    },
    onSuccess: (data) => {
      toast.success("Secret rotated successfully");
      setRevealSecret(data.secret);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.webhook.list({ projectId }),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.webhook.getEndpoint(webhook.id),
      });
    },
  });

  const handleRotateSecret = async () => {
    const res = await openDialog({
      confirmText: "Rotate",
      description:
        "Are you sure you want to rotate this webhook's secret? The old secret will stop working immediately.",
      title: "Rotate secret",
    });
    if (res) {
      rotateSecret({ endpointId: webhook.id });
    }
  };

  // Test webhook
  const { mutate: testWebhook, status: testWebhookStatus } = useMutation({
    ...testWebhookEndpointOptions(),
    onError: () => {
      toast.error("Failed to send test webhook");
    },
    onSuccess: () => {
      toast.success("Test webhook sent");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.webhook.deliveries({
          projectId,
          endpointId: webhook.id,
        }),
      });
    },
  });

  const handleTest = () => {
    testWebhook({ endpointId: webhook.id });
  };

  const isLoading =
    deleteWebhookStatus === "pending" ||
    rotateSecretStatus === "pending" ||
    testWebhookStatus === "pending";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="z-20" disabled={isLoading} size="icon" variant="outline">
            <EllipsisVerticalIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem className="cursor-pointer" onClick={() => setIsEditOpen(true)}>
            <PencilIcon className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={testWebhookStatus === "pending"}
            onClick={handleTest}
          >
            <SendIcon className="mr-2 h-4 w-4" />
            Send Test
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={rotateSecretStatus === "pending"}
            onClick={handleRotateSecret}
          >
            <RefreshCwIcon className="mr-2 h-4 w-4" />
            Rotate Secret
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            disabled={deleteWebhookStatus === "pending"}
            onClick={handleDelete}
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationDialog />
      <EditWebhookModal
        onClose={() => setIsEditOpen(false)}
        open={isEditOpen}
        projectId={projectId}
        webhook={webhook}
      />
      <WebhookSecretRevealModal
        onClose={() => setRevealSecret(null)}
        open={!!revealSecret}
        secret={revealSecret}
      />
    </>
  );
}

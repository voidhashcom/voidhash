"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { WebhookEndpoint } from "@voidhash/rpc";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useConfirmDialog,
} from "@voidhash/ui";
import {
  ChevronRightIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  RefreshCwIcon,
  SendIcon,
  TrashIcon,
} from "lucide-react";
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

interface WebhookEndpointRecordProps {
  webhook: typeof WebhookEndpoint.Type;
  projectId: string;
  organizationSlug: string;
  projectSlug: string;
}

export function WebhookEndpointRecord({
  webhook,
  projectId,
  organizationSlug,
  projectSlug,
}: WebhookEndpointRecordProps) {
  const queryClient = useQueryClient();
  const { ConfirmationDialog, openDialog } = useConfirmDialog();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [revealSecret, setRevealSecret] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

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
    },
  });

  const handleDelete = async () => {
    const res = await openDialog({
      confirmText: "Delete",
      description: "Are you sure you want to delete this webhook? This action cannot be undone.",
      title: "Delete webhook",
    });
    if (res) {
      deleteWebhook({ endpointId: webhook.id, projectId });
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
      rotateSecret({ endpointId: webhook.id, projectId });
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
    },
  });

  const handleTest = () => {
    testWebhook({ endpointId: webhook.id, projectId });
  };

  const statusBadge = {
    active: <Badge variant="default">Active</Badge>,
    disabled: <Badge variant="secondary">Disabled</Badge>,
    failed: <Badge variant="destructive">Failed</Badge>,
  };

  const isLoading =
    deleteWebhookStatus === "pending" ||
    rotateSecretStatus === "pending" ||
    testWebhookStatus === "pending";

  return (
    <div className="group relative isolate px-6 py-4 hover:bg-accent/30">
      <Link
        className="absolute inset-0 z-10"
        params={{
          endpointId: webhook.id,
          organizationSlug,
          projectSlug,
        }}
        to="/studio/$organizationSlug/$projectSlug/settings/webhooks/$endpointId"
      />
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-1 items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">{webhook.name}</p>
              {statusBadge[webhook.status]}
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="relative z-20 mt-1 max-w-xs cursor-pointer truncate text-left text-muted-foreground text-sm"
                    onClick={() => copyToClipboard(webhook.url, "URL")}
                    type="button"
                  >
                    {webhook.url}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click to copy URL</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="mt-1 text-muted-foreground text-xs">
              {webhook.events.length} event
              {webhook.events.length !== 1 ? "s" : ""} subscribed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
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
        </div>
      </div>
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
    </div>
  );
}

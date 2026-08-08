"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiKey, ApiKeyWithRawKey } from "@voidhash/rpc";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useConfirmDialog,
} from "@voidhash/ui";
import { EllipsisVerticalIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteApiKeyOptions,
  queryKeys,
  rotateSecretKeyOptions,
} from "@/features/studio/lib/tanstack-query";

import { SecretKeyRevealModal } from "./secret-key-reveal-modal";

export function ApiKeyRecord({ apiKey }: { apiKey: typeof ApiKey.Type }) {
  const queryClient = useQueryClient();
  const [secretKey, setSecretKey] = useState<typeof ApiKeyWithRawKey.Type | null>(null);
  const { ConfirmationDialog, openDialog } = useConfirmDialog();

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Rotate key
  const { mutate: rotateSecretKey, status: rotateSecretKeyStatus } = useMutation({
    ...rotateSecretKeyOptions(),
    onSuccess: () => {
      toast.success("Key successfully rotated");
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKey.all });
    },
    onError: () => {
      toast.error("Failed to rotate key");
    },
  });

  const handleRotateKey = async () => {
    const res = await openDialog({
      confirmText: "Rotate",
      description:
        "Are you sure you want to rotate this key? It may break any services that are using it.",
      title: "Rotate key",
    });
    if (res) {
      rotateSecretKey({
        apiKeyId: apiKey.id,
      });
    }
  };

  // Delete key
  const { mutate: deleteSecretKey, status: deleteSecretKeyStatus } = useMutation({
    ...deleteApiKeyOptions(),
    onSuccess: () => {
      toast.success("Key successfully deleted");
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKey.all });
    },
    onError: () => {
      toast.error("Failed to delete key");
    },
  });

  const handleDeleteKey = async () => {
    const res = await openDialog({
      confirmText: "Delete",
      description:
        "Are you sure you want to delete this key? It may break any services that are using it. This action cannot be undone.",
      title: "Delete key",
    });
    if (res) {
      deleteSecretKey({
        apiKeyId: apiKey.id,
      });
    }
  };
  return (
    <div className="group relative isolate px-6 py-4 hover:bg-accent/30">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-1 items-start gap-4">
          <div className="w-42">{apiKey.name}</div>

          {apiKey?.isPublic ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="cursor-pointer text-left"
                    onClick={() => copyToClipboard(apiKey.key)}
                    type="button"
                  >
                    <p className="w-64 whitespace-pre-wrap break-words text-muted-foreground">
                      {apiKey.key}
                    </p>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click to copy</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <p className="w-64 whitespace-pre-wrap text-muted-foreground">
              {apiKey.prefix}...{apiKey.end}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Only secret keys are deletable */}
          {!apiKey.isPublic && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="z-20" size="icon" variant="outline">
                  <EllipsisVerticalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={rotateSecretKeyStatus === "pending"}
                  onClick={handleRotateKey}
                >
                  Rotate key
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={deleteSecretKeyStatus === "pending"}
                  onClick={handleDeleteKey}
                >
                  Delete key
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <ConfirmationDialog />
      <SecretKeyRevealModal
        apiKey={secretKey}
        onClose={() => setSecretKey(null)}
        open={!!secretKey}
      />
    </div>
  );
}

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@voidhash/ui";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { queryKeys, renamePaywallAssetOptions } from "@/features/studio/lib/tanstack-query";

export interface RenameAssetDialogProps {
  organizationId: string;
  asset: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Small controlled dialog that renames a paywall asset via `RenamePaywallAsset`. */
export function RenameAssetDialog({
  organizationId,
  asset,
  open,
  onOpenChange,
}: RenameAssetDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(asset.name);

  useEffect(() => {
    if (open) {
      setName(asset.name);
    }
  }, [open, asset.name]);

  const { mutate: rename, status } = useMutation({
    ...renamePaywallAssetOptions(),
    onError: () => toast.error("Failed to rename image"),
    onSuccess: async () => {
      toast.success("Image renamed");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.paywallAsset.list({ organizationId }),
      });
      onOpenChange(false);
    },
  });

  const isPending = status === "pending";
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== asset.name && !isPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename image</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) {
              rename({ assetId: asset.id, name: trimmed });
            }
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-asset-name">Name</Label>
            <Input
              autoFocus
              id="rename-asset-name"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={!canSubmit} type="submit">
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

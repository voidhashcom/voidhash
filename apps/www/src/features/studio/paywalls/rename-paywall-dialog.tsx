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
import { queryKeys, renamePaywallOptions } from "@/features/studio/lib/tanstack-query";

export interface RenamePaywallDialogProps {
  projectId: string;
  paywall: { id: string; name: string; slug: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Controlled dialog that renames a paywall via `RenamePaywall`. Only the
 * display name is editable — the slug is the paywall's stable identifier and is
 * intentionally immutable, so it is shown read-only for reference.
 */
export function RenamePaywallDialog({
  projectId,
  paywall,
  open,
  onOpenChange,
}: RenamePaywallDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(paywall.name);

  useEffect(() => {
    if (open) {
      setName(paywall.name);
    }
  }, [open, paywall.name]);

  const { mutate: rename, status } = useMutation({
    ...renamePaywallOptions(),
    onError: () => toast.error("Failed to rename paywall"),
    onSuccess: async () => {
      toast.success("Paywall renamed");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.paywall.list({ projectId }),
      });
      onOpenChange(false);
    },
  });

  const isPending = status === "pending";
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== paywall.name && !isPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename paywall</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) {
              rename({ name: trimmed, paywallId: paywall.id });
            }
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-paywall-name">Name</Label>
            <Input
              autoFocus
              id="rename-paywall-name"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-paywall-slug">Slug</Label>
            <Input disabled id="rename-paywall-slug" readOnly value={paywall.slug} />
            <p className="text-muted-foreground text-xs">
              The slug is fixed and never changes when you rename a paywall.
            </p>
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

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { Paywall } from "@voidhash/rpc";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voidhash/ui";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  archivePaywallOptions,
  deletePaywallOptions,
  queryKeys,
  restorePaywallOptions,
} from "@/features/studio/lib/tanstack-query";

import { RenamePaywallDialog } from "./rename-paywall-dialog";

interface PaywallActionsMenuProps {
  paywall: typeof Paywall.Type;
  organizationSlug: string;
  projectSlug: string;
  align?: "start" | "center" | "end";
  triggerClassName?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
}

/**
 * Kebab menu of actions for a single paywall — Edit (straight into the
 * designer) / Rename / Archive (or Restore) / Delete — together with the
 * rename dialog and delete confirmation it drives. Shared by the dashboard
 * grid card and table row so both surface identical behaviour.
 */
export function PaywallActionsMenu({
  paywall,
  organizationSlug,
  projectSlug,
  align = "end",
  triggerClassName,
  triggerVariant = "ghost",
}: PaywallActionsMenuProps) {
  const queryClient = useQueryClient();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isArchived = paywall.archivedAt != null;

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.paywall.list({ projectId: paywall.projectId }),
    });

  const { mutate: archive, status: archiveStatus } = useMutation({
    ...archivePaywallOptions(),
    onError: () => toast.error("Failed to archive paywall"),
    onSuccess: async () => {
      toast.success("Paywall archived");
      await invalidate();
    },
  });

  const { mutate: restore, status: restoreStatus } = useMutation({
    ...restorePaywallOptions(),
    onError: () => toast.error("Failed to restore paywall"),
    onSuccess: async () => {
      toast.success("Paywall restored");
      await invalidate();
    },
  });

  const { mutate: remove, status: deleteStatus } = useMutation({
    ...deletePaywallOptions(),
    onError: () => toast.error("Failed to delete paywall"),
    onSuccess: async () => {
      toast.success("Paywall deleted");
      await invalidate();
      setDeleteOpen(false);
    },
  });

  const isDeleting = deleteStatus === "pending";
  const isMutating = archiveStatus === "pending" || restoreStatus === "pending";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Paywall actions"
            className={cn(triggerClassName)}
            disabled={isMutating}
            size="icon-sm"
            variant={triggerVariant}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align}>
          <DropdownMenuItem asChild>
            <Link
              params={{ id: paywall.id, organizationSlug, projectSlug }}
              to="/studio/$organizationSlug/$projectSlug/design/$id"
            >
              <SquarePenIcon />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          {isArchived ? (
            <DropdownMenuItem onSelect={() => restore({ paywallId: paywall.id })}>
              <ArchiveRestoreIcon />
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => archive({ paywallId: paywall.id })}>
              <ArchiveIcon />
              Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDeleteOpen(true)} variant="destructive">
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenamePaywallDialog
        onOpenChange={setRenameOpen}
        open={renameOpen}
        paywall={paywall}
        projectId={paywall.projectId}
      />

      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete paywall</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <span className="font-medium">{paywall.name}</span>? This cannot be
              undone. If this paywall might still be shown to users, archive it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                remove({ paywallId: paywall.id });
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

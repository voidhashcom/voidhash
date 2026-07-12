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
  Badge,
  Button,
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
  Smartphone,
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

interface PaywallCardProps {
  paywall: typeof Paywall.Type;
  organizationSlug: string;
  projectSlug: string;
}

/**
 * A single paywall tile in the dashboard grid: a link into the designer plus a
 * kebab menu with Rename / Archive (or Restore) / Delete. Archived paywalls are
 * dimmed and badged, and expose Restore in place of Archive.
 */
export function PaywallCard({ paywall, organizationSlug, projectSlug }: PaywallCardProps) {
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
    <div className="group relative">
      <Link
        className={`flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-foreground/20 hover:shadow-lg ${
          isArchived ? "opacity-60" : ""
        }`}
        params={{ id: paywall.id, organizationSlug, projectSlug }}
        to="/studio/$organizationSlug/$projectSlug/design/$id"
      >
        {/* Preview Area */}
        <div className="relative flex aspect-3/4 items-center justify-center bg-muted/50">
          {paywall.thumbnailUrl ? (
            <img
              alt={paywall.name}
              className="absolute inset-0 size-full object-cover"
              loading="lazy"
              src={paywall.thumbnailUrl}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Smartphone className="h-12 w-12 opacity-30" />
            </div>
          )}
        </div>

        {/* Info Area */}
        <div className="border-t p-4">
          <h3 className="truncate font-medium">{paywall.name}</h3>
          <p className="mt-0.5 truncate text-muted-foreground text-sm">{paywall.slug}</p>
        </div>
      </Link>

      {isArchived && (
        <Badge className="absolute top-2 left-2" variant="secondary">
          Archived
        </Badge>
      )}

      <div className="absolute top-2 right-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Paywall actions"
              className="size-7 bg-background/80 backdrop-blur-sm"
              disabled={isMutating}
              size="icon-sm"
              variant="secondary"
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
      </div>

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
    </div>
  );
}

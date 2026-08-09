"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PaywallAssetSchema } from "@voidhash/rpc";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@voidhash/ui";
import { Effect } from "effect";
import { CopyIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deletePaywallAssetOptions, queryKeys } from "@/features/studio/lib/tanstack-query";
import { CheckerboardBackground } from "@/features/studio/paywalls/designer/components/ui/color-picker/checkerboard-background";

import { RenameAssetDialog } from "./rename-asset-dialog";
import { formatBytes } from "./upload-image";

type PaywallAsset = typeof PaywallAssetSchema.Type;

export interface AssetTileProps {
  organizationId: string;
  asset: PaywallAsset;
  selectable?: boolean;
  onSelect?: (asset: PaywallAsset) => void;
}

/**
 * A single square thumbnail in the asset library grid. Shows the image over a
 * checkerboard (so transparency reads), the name + human-readable size, and a
 * kebab menu with rename / copy-URL / delete. When `selectable`, the whole tile
 * is a button that calls `onSelect`.
 */
export function AssetTile({ organizationId, asset, selectable, onSelect }: AssetTileProps) {
  const queryClient = useQueryClient();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { mutate: deleteAsset, status: deleteStatus } = useMutation({
    ...deletePaywallAssetOptions(),
    onError: () => toast.error("Failed to delete image"),
    onSuccess: async () => {
      toast.success("Image deleted");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.paywallAsset.list({ organizationId }),
      });
      setDeleteOpen(false);
    },
  });

  const isDeleting = deleteStatus === "pending";

  const copyUrl = () =>
    Effect.runPromise(
      Effect.tryPromise(() => navigator.clipboard.writeText(asset.url)).pipe(
        Effect.tap(() => Effect.sync(() => toast.success("Image URL copied"))),
        Effect.catchCause(() => Effect.sync(() => toast.error("Could not copy the URL"))),
      ),
    );

  const thumbnail = (
    <div className="relative aspect-square w-full overflow-hidden rounded-md border bg-muted">
      <CheckerboardBackground />
      <img
        alt={asset.name}
        className="absolute inset-0 size-full object-cover"
        loading="lazy"
        src={asset.url}
      />
    </div>
  );

  return (
    <div className="group flex flex-col gap-1.5">
      <div className="relative">
        {selectable ? (
          <button
            aria-label={`Select ${asset.name}`}
            className="block w-full rounded-md ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => onSelect?.(asset)}
            type="button"
          >
            {thumbnail}
          </button>
        ) : (
          thumbnail
        )}

        <div className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Image actions"
                className="size-6 bg-background/80 backdrop-blur-sm"
                size="icon-sm"
                variant="ghost"
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                <PencilIcon />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyUrl()}>
                <CopyIcon />
                Copy URL
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDeleteOpen(true)} variant="destructive">
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-col">
        <span className="truncate text-xs font-medium" title={asset.name}>
          {asset.name}
        </span>
        <span className="text-[11px] text-muted-foreground">{formatBytes(asset.sizeBytes)}</span>
      </div>

      <RenameAssetDialog
        asset={asset}
        onOpenChange={setRenameOpen}
        open={renameOpen}
        organizationId={organizationId}
      />

      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete image</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <span className="font-medium">{asset.name}</span>? Paywalls already using this
              image URL will no longer be able to load it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                deleteAsset({ assetId: asset.id });
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

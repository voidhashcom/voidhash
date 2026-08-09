"use client";

import type { PaywallAssetSchema } from "@voidhash/rpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voidhash/ui";

import { AssetLibrary } from "./asset-library";

type PaywallAsset = typeof PaywallAssetSchema.Type;

export interface AssetPickerDialogProps {
  /**
   * Organization whose asset library is shown. When `null` (route slugs not
   * resolvable) the library grid is hidden, since images can only come from the
   * organization's asset library.
   */
  organizationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: PaywallAsset) => void;
}

/**
 * Modal that hosts the {@link AssetLibrary} in selectable mode for choosing a
 * background image from the organization's asset library. Selecting a tile
 * hands the asset back and closes the dialog. Uploading is available inline.
 */
export function AssetPickerDialog({
  organizationId,
  open,
  onOpenChange,
  onSelect,
}: AssetPickerDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose an image</DialogTitle>
          <DialogDescription>
            Pick an image from your library or upload a new one.
          </DialogDescription>
        </DialogHeader>

        {organizationId ? (
          <div className="max-h-[60vh] overflow-y-auto">
            <AssetLibrary
              onSelect={(asset) => {
                onSelect(asset);
                onOpenChange(false);
              }}
              organizationId={organizationId}
              selectable
            />
          </div>
        ) : (
          <p className="rounded-md border border-dashed py-8 text-center text-muted-foreground text-sm">
            Your asset library is unavailable here.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

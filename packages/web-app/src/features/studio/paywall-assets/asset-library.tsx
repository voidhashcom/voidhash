"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PaywallAssetSchema } from "@voidhash/rpc";
import { Button, Skeleton, cn } from "@voidhash/ui";
import { Effect, Result } from "effect";
import { ImagesIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  listPaywallAssetsOptions,
  queryKeys,
  uploadPaywallAssetOptions,
} from "@/features/studio/lib/tanstack-query";

import { AssetTile } from "./asset-tile";
import {
  ACCEPTED_ASSET_ACCEPT,
  AssetUploadValidationError,
  prepareAssetUpload,
} from "./upload-image";

type PaywallAsset = typeof PaywallAssetSchema.Type;

export interface AssetLibraryProps {
  organizationId: string;
  /** When true, tiles are clickable and invoke {@link onSelect}. */
  selectable?: boolean;
  onSelect?: (asset: PaywallAsset) => void;
  className?: string;
}

const GRID_CLASSES = "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

/** Maps a server-side upload failure to a friendly message (surfacing validation text). */
function uploadErrorMessage(error: unknown, fileName: string): string {
  const fallback = `Failed to upload "${fileName}"`;
  return error &&
    typeof error === "object" &&
    "_tag" in error &&
    error._tag === "EffectQueryFailure"
    ? (
        error as unknown as {
          match: (matcher: {
            "Rpc/PaywallAssetValidationError": (failure: { message: string }) => string;
            "Rpc/ActionForbiddenError": (failure: { message: string }) => string;
            OrElse: () => string;
          }) => string;
        }
      ).match({
        "Rpc/ActionForbiddenError": (failure) => failure.message,
        "Rpc/PaywallAssetValidationError": (failure) => failure.message,
        OrElse: () => fallback,
      })
    : fallback;
}

/**
 * Organization-scoped paywall image library. Renders a responsive thumbnail
 * grid with per-asset actions (rename / copy URL / delete) and an upload
 * affordance backed by a hidden multi-file input. Uploads are validated
 * client-side (type + 8 MiB cap), stamped with natural dimensions, and sent as
 * original bytes — no re-encoding. When `selectable`, clicking a tile calls
 * `onSelect`; the same component powers both the management page and the
 * designer picker.
 */
export function AssetLibrary({
  organizationId,
  selectable,
  onSelect,
  className,
}: AssetLibraryProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: assets, isPending } = useQuery(listPaywallAssetsOptions({ organizationId }));

  const uploadAsset = useMutation({
    ...uploadPaywallAssetOptions(),
  });

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Reset so selecting the same file again re-triggers onChange.
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    let uploaded = 0;
    // Sequential uploads keep memory low and give per-file error toasts.
    const uploadAll = Effect.promise(async () => {
      for (const file of files) {
        const outcome = await Effect.runPromise(
          Effect.gen(function* () {
            const prepared = yield* Effect.tryPromise({
              catch: (error: unknown) => error,
              try: () => prepareAssetUpload(file),
            });
            yield* Effect.tryPromise({
              catch: (error: unknown) => error,
              try: () => uploadAsset.mutateAsync({ organizationId, ...prepared }),
            });
          }).pipe(Effect.result),
        );
        if (Result.isFailure(outcome)) {
          const error = outcome.failure;
          if (error instanceof AssetUploadValidationError) {
            toast.error(error.message);
          } else {
            toast.error(uploadErrorMessage(error, file.name));
          }
          continue;
        }
        uploaded += 1;
      }
    });
    await Effect.runPromise(
      uploadAll.pipe(Effect.ensuring(Effect.sync(() => setIsUploading(false)))),
    );

    if (uploaded > 0) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.paywallAsset.list({ organizationId }),
      });
      toast.success(uploaded === 1 ? "Image uploaded" : `${uploaded} images uploaded`);
    }
  };

  const uploadButton = (
    <Button
      disabled={isUploading}
      onClick={() => inputRef.current?.click()}
      size="sm"
      type="button"
    >
      <UploadIcon />
      {isUploading ? "Uploading..." : "Upload"}
    </Button>
  );

  const hiddenInput = (
    <input
      accept={ACCEPTED_ASSET_ACCEPT}
      className="hidden"
      multiple
      onChange={(event) => void handleFilesSelected(event)}
      ref={inputRef}
      type="file"
    />
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-end">{uploadButton}</div>
      {hiddenInput}

      {isPending ? (
        <div className={GRID_CLASSES}>
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton className="aspect-square w-full rounded-md" key={index} />
          ))}
        </div>
      ) : !assets || assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <ImagesIcon className="size-8 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="font-medium text-sm">Upload your first image</p>
            <p className="text-muted-foreground text-xs">
              PNG, JPEG, WebP, or GIF up to 8 MB. Uploaded images can be used as paywall
              backgrounds.
            </p>
          </div>
          {uploadButton}
        </div>
      ) : (
        <div className={GRID_CLASSES}>
          {assets.map((asset) => (
            <AssetTile
              asset={asset}
              key={asset.id}
              onSelect={onSelect}
              organizationId={organizationId}
              selectable={selectable}
            />
          ))}
        </div>
      )}
    </div>
  );
}

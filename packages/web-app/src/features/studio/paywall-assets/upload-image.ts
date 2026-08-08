import { Effect } from "effect";

/** Accepted upload MIME types — kept in sync with the server-side allow-list. */
export const ACCEPTED_ASSET_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

/** `accept` attribute value for the hidden file input. */
export const ACCEPTED_ASSET_ACCEPT = ACCEPTED_ASSET_TYPES.join(",");

/** Maximum decoded image size the server accepts (8 MiB). */
export const MAX_ASSET_BYTES = 8 * 1024 * 1024;

/** Payload handed to the {@link uploadPaywallAssetOptions} mutation. */
export interface PreparedAssetUpload {
  name: string;
  contentType: string;
  imageBase64: string;
  width?: number;
  height?: number;
}

/** Error thrown by {@link prepareAssetUpload} when a file fails client-side validation. */
export class AssetUploadValidationError extends Error {}

/** Formats a byte count as a short human-readable string (e.g. "1.2 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

const readAsDataUrl = (file: Blob): Promise<string> =>
  Effect.runPromise(
    Effect.callback<string, Error>((resume) => {
      const reader = new FileReader();
      reader.onloadend = () => resume(Effect.succeed(reader.result as string));
      reader.onerror = () =>
        resume(Effect.fail(reader.error ?? new Error("Failed to read file")));
      reader.readAsDataURL(file);
    }),
  );

const readImageDimensions = (dataUrl: string): Promise<{ width: number; height: number } | null> =>
  Effect.runPromise(
    Effect.callback<{ width: number; height: number } | null>((resume) => {
      const image = new Image();
      image.addEventListener("load", () =>
        resume(Effect.succeed({ height: image.naturalHeight, width: image.naturalWidth })),
      );
      // Dimensions are best-effort metadata; a decode failure here shouldn't block
      // an otherwise valid upload (e.g. some GIFs), so resolve null instead.
      image.addEventListener("error", () => resume(Effect.succeed(null)));
      image.src = dataUrl;
    }),
  );

/**
 * Validates a selected file against the type allow-list and 8 MiB cap, reads its
 * natural dimensions, and returns the original bytes as base64 (the `data:`
 * prefix is kept — the server strips it). Background images are uploaded as-is:
 * no re-encoding or downscaling, since the original fidelity is what matters.
 *
 * @throws {AssetUploadValidationError} when the type or size is rejected.
 */
export async function prepareAssetUpload(file: File): Promise<PreparedAssetUpload> {
  if (!(ACCEPTED_ASSET_TYPES as readonly string[]).includes(file.type)) {
    // `runPromise` squashes the cause, so the rejection is the validation error
    // itself — callers keep matching it with `instanceof`.
    return Effect.runPromise(
      Effect.fail(
        new AssetUploadValidationError(
          `"${file.name}" is not a supported image type. Use PNG, JPEG, WebP, or GIF.`,
        ),
      ),
    );
  }
  if (file.size > MAX_ASSET_BYTES) {
    return Effect.runPromise(
      Effect.fail(
        new AssetUploadValidationError(
          `"${file.name}" is ${formatBytes(file.size)}. Images must be 8 MB or smaller.`,
        ),
      ),
    );
  }

  const dataUrl = await readAsDataUrl(file);
  const dimensions = await readImageDimensions(dataUrl);

  return {
    contentType: file.type,
    height: dimensions?.height,
    imageBase64: dataUrl,
    name: file.name,
    width: dimensions?.width,
  };
}

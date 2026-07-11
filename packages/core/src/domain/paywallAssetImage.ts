import { Effect, Schema } from "effect";

/**
 * Raised when an uploaded paywall asset image fails validation (unsupported
 * type, too large, malformed base64, or bytes that do not match the declared
 * image type). Surfaced to the RPC layer as a typed error so the studio can
 * show an actionable message instead of a generic failure.
 */
export class PaywallAssetValidationError extends Schema.TaggedErrorClass<PaywallAssetValidationError>(
  "PaywallAssetValidationError",
)("PaywallAssetValidationError", { message: Schema.String }) {}

/**
 * Allowed paywall-asset content types mapped to their stored file extension.
 * GIF is included (in addition to the avatar allowlist) because animated
 * backgrounds are a legitimate paywall use case; its magic bytes are sniffed
 * below like every other type.
 */
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Hard upper bound on a decoded paywall asset (8 MiB). Backgrounds can be
 * full-bleed high-resolution images, so this cap is larger than the avatar
 * cap while still guarding against abuse.
 */
export const MAX_PAYWALL_ASSET_BYTES = 8 * 1024 * 1024;

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((b, i) => bytes[offset + i] === b);

/** Magic-byte sniff: confirm the decoded bytes actually match the claimed type. */
const matchesContentType = (bytes: Uint8Array, contentType: string): boolean => {
  switch (contentType) {
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/webp":
      // "RIFF" <4-byte length> "WEBP"
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
      );
    case "image/gif":
      // "GIF87a" or "GIF89a"
      return (
        startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      );
    default:
      return false;
  }
};

const decodeBase64 = (base64: string): Uint8Array => {
  // Tolerate a `data:<type>;base64,` prefix even though the studio sends raw base64.
  const comma = base64.indexOf(",");
  const payload = base64.startsWith("data:") && comma !== -1 ? base64.slice(comma + 1) : base64;
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const MAX_MB = Math.round(MAX_PAYWALL_ASSET_BYTES / 1024 / 1024);

/**
 * Validates the claimed content type, decodes the base64 payload, and confirms
 * the bytes are a recognised image within the size cap. Returns the decoded
 * bytes and the file extension to use for the stored object key.
 */
export const validateAndDecodePaywallAsset = (input: {
  readonly imageBase64: string;
  readonly contentType: string;
}): Effect.Effect<
  { readonly bytes: Uint8Array; readonly ext: string },
  PaywallAssetValidationError
> =>
  Effect.gen(function* () {
    const ext = CONTENT_TYPE_EXTENSIONS[input.contentType];
    if (!ext) {
      return yield* Effect.fail(
        new PaywallAssetValidationError({
          message: `Unsupported image type "${input.contentType}". Use PNG, JPEG, WebP, or GIF.`,
        }),
      );
    }

    // Reject obviously-oversized payloads from the base64 length BEFORE
    // allocating the decoded buffer (every 4 base64 chars decode to 3 bytes).
    if (Math.floor((input.imageBase64.length * 3) / 4) > MAX_PAYWALL_ASSET_BYTES + 64) {
      return yield* Effect.fail(
        new PaywallAssetValidationError({ message: `Image is too large (max ${MAX_MB}MB).` }),
      );
    }

    const bytes = yield* Effect.try({
      try: () => decodeBase64(input.imageBase64),
      catch: () => new PaywallAssetValidationError({ message: "Image data is not valid base64." }),
    });

    if (bytes.length === 0) {
      return yield* Effect.fail(new PaywallAssetValidationError({ message: "Image is empty." }));
    }
    if (bytes.length > MAX_PAYWALL_ASSET_BYTES) {
      return yield* Effect.fail(
        new PaywallAssetValidationError({ message: `Image is too large (max ${MAX_MB}MB).` }),
      );
    }
    if (!matchesContentType(bytes, input.contentType)) {
      return yield* Effect.fail(
        new PaywallAssetValidationError({
          message: "Image data does not match its declared type.",
        }),
      );
    }

    return { bytes, ext };
  });

/** SHA-256 hex digest of the asset bytes (WebCrypto; available in workerd). */
export const paywallAssetSha256Hex = (bytes: Uint8Array): Effect.Effect<string> =>
  Effect.promise(async () => {
    const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  });

/** Content-addressed object key: `paywall-assets/<organizationId>/<sha256>.<ext>`. */
export const derivePaywallAssetKey = (
  organizationId: string,
  sha256Hex: string,
  ext: string,
): string => `paywall-assets/${organizationId}/${sha256Hex}.${ext}`;

/**
 * Whether a stored asset URL points at an object owned by the given
 * organization in our own public file store (so it is safe to delete). Guards
 * both against deleting external URLs and against deleting another org's object.
 */
export const isOwnedPaywallAssetUrl = (
  url: string | null,
  organizationId: string,
  publicBaseUrl: string,
): boolean =>
  url !== null && url.startsWith(`${publicBaseUrl}/files/paywall-assets/${organizationId}/`);

/**
 * Extracts the object key from one of our public paywall-asset URLs when it is
 * owned by `organizationId`, or `null`. The org-prefix check keeps deletion
 * scoped to the caller's own objects.
 */
export const paywallAssetKeyFromUrl = (
  url: string,
  organizationId: string,
  publicBaseUrl: string,
): string | null => {
  const prefix = `${publicBaseUrl}/files/`;
  if (!url.startsWith(prefix)) {
    return null;
  }
  const key = url.slice(prefix.length);
  return key.startsWith(`paywall-assets/${organizationId}/`) ? key : null;
};

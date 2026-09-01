import { subtle } from "uncrypto";

import { promiseOrDie } from "../effect-boundary.ts";
import * as Effect from "effect/Effect";
import * as Encoding from "effect/Encoding";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/**
 * Raised when an uploaded avatar fails validation (unsupported type, too large,
 * malformed base64, or bytes that do not match the declared image type).
 * Surfaced to the RPC layer as a typed error so the studio can show an
 * actionable message instead of a generic failure.
 */
export class AvatarValidationError extends Schema.TaggedErrorClass<AvatarValidationError>(
  "AvatarValidationError",
)("AvatarValidationError", { message: Schema.String }) {}

/** Entities that can carry an avatar; used as the first key segment. */
export type AvatarEntity = "organization" | "project" | "user";

/** Allowed avatar content types mapped to their stored file extension. */
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Hard upper bound on a decoded avatar (2 MiB). The studio crops/resizes to a
 * small square before upload, so this only guards against abuse.
 */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((b, i) => bytes[offset + i] === b);

/** Magic-byte sniff: confirm the decoded bytes actually match the claimed type. */
const matchesContentType = (bytes: Uint8Array, contentType: string): boolean => {
  if (contentType === "image/png")
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (contentType === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (contentType === "image/webp")
    return (
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
    );
  return false;
};

/** Tolerate a `data:<type>;base64,` prefix even though the studio sends raw base64. */
const base64Payload = (base64: string): string => {
  const comma = base64.indexOf(",");
  if (base64.startsWith("data:") && comma !== -1) {
    return base64.slice(comma + 1);
  }
  return base64;
};

/**
 * Copies `bytes` into a standalone `ArrayBuffer` so it can be handed to
 * WebCrypto, whose `BufferSource` parameter does not accept a view over a
 * possibly-shared buffer.
 */
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

/**
 * Validates the claimed content type, decodes the base64 payload, and confirms
 * the bytes are a recognised image within the size cap. Returns the decoded
 * bytes and the file extension to use for the stored object key.
 */
export const validateAndDecodeAvatar = (input: {
  readonly imageBase64: string;
  readonly contentType: string;
}): Effect.Effect<{ readonly bytes: Uint8Array; readonly ext: string }, AvatarValidationError> =>
  Effect.gen(function* () {
    const ext = CONTENT_TYPE_EXTENSIONS[input.contentType];
    if (!ext) {
      return yield* Effect.fail(
        new AvatarValidationError({
          message: `Unsupported image type "${input.contentType}". Use PNG, JPEG, or WebP.`,
        }),
      );
    }

    // Reject obviously-oversized payloads from the base64 length BEFORE
    // allocating the decoded buffer (every 4 base64 chars decode to 3 bytes).
    if (Math.floor((input.imageBase64.length * 3) / 4) > MAX_AVATAR_BYTES + 64) {
      return yield* Effect.fail(
        new AvatarValidationError({
          message: `Image is too large (max ${Math.round(MAX_AVATAR_BYTES / 1024 / 1024)}MB).`,
        }),
      );
    }

    const bytes = yield* Effect.fromResult(
      Encoding.decodeBase64(base64Payload(input.imageBase64)),
    ).pipe(
      Effect.mapError(
        () => new AvatarValidationError({ message: "Image data is not valid base64." }),
      ),
    );

    if (bytes.byteLength === 0) {
      return yield* Effect.fail(new AvatarValidationError({ message: "Image is empty." }));
    }
    if (bytes.length > MAX_AVATAR_BYTES) {
      return yield* Effect.fail(
        new AvatarValidationError({
          message: `Image is too large (max ${Math.round(MAX_AVATAR_BYTES / 1024 / 1024)}MB).`,
        }),
      );
    }
    if (!matchesContentType(bytes, input.contentType)) {
      return yield* Effect.fail(
        new AvatarValidationError({ message: "Image data does not match its declared type." }),
      );
    }

    return { bytes, ext };
  });

/** SHA-256 hex digest of the avatar bytes (WebCrypto; available in workerd). */
export const avatarSha256Hex = (bytes: Uint8Array): Effect.Effect<string> =>
  promiseOrDie(() => subtle.digest("SHA-256", toArrayBuffer(bytes))).pipe(
    Effect.map((digest) =>
      Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    ),
  );

/** Content-addressed object key: `avatars/<entity>/<id>/<sha256>.<ext>`. */
export const deriveAvatarKey = (
  entity: AvatarEntity,
  id: string,
  sha256Hex: string,
  ext: string,
): string => `avatars/${entity}/${id}/${sha256Hex}.${ext}`;

/**
 * Whether a stored `logo` value points at an object in our own public file
 * store (so it is safe to delete on replace/remove). Guards against deleting
 * historical/external URLs (e.g. a WorkOS-provided logo).
 */
export const isOwnedAvatarUrl = (
  logo: Option.Option<string>,
  publicBaseUrl: string,
): boolean => Option.exists(logo, (url) => url.startsWith(`${publicBaseUrl}/files/`));

/** Extracts the object key from one of our public file URLs. */
export const avatarKeyFromUrl = (logo: string, publicBaseUrl: string): Option.Option<string> => {
  const prefix = `${publicBaseUrl}/files/`;
  if (!logo.startsWith(prefix)) {
    return Option.none();
  }
  return Option.some(logo.slice(prefix.length));
};

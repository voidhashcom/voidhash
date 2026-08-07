import { Effect } from "effect";

import {
  AvatarValidationError,
  MAX_AVATAR_BYTES,
  avatarKeyFromUrl,
  avatarSha256Hex,
  deriveAvatarKey,
  isOwnedAvatarUrl,
  validateAndDecodeAvatar,
} from "../../src/domain/avatar.ts";
import { describe, expect, it } from "../../src/testing/effect-vitest.ts";

const toBase64 = (bytes: number[]): string =>
  Buffer.from(Uint8Array.from(bytes)).toString("base64");

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
// "RIFF" <4-byte length> "WEBP"
const WEBP_SIGNATURE = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

describe("validateAndDecodeAvatar", () => {
  it.effect("accepts a PNG and returns the png extension", () =>
    Effect.gen(function* () {
      const result = yield* validateAndDecodeAvatar({
        imageBase64: toBase64(PNG_SIGNATURE),
        contentType: "image/png",
      });
      expect(result.ext).toBe("png");
      expect(Array.from(result.bytes.slice(0, 8))).toEqual(PNG_SIGNATURE);
    }),
  );

  it.effect("accepts a JPEG and returns the jpg extension", () =>
    Effect.gen(function* () {
      const result = yield* validateAndDecodeAvatar({
        imageBase64: toBase64(JPEG_SIGNATURE),
        contentType: "image/jpeg",
      });
      expect(result.ext).toBe("jpg");
    }),
  );

  it.effect("accepts a WebP and returns the webp extension", () =>
    Effect.gen(function* () {
      const result = yield* validateAndDecodeAvatar({
        imageBase64: toBase64(WEBP_SIGNATURE),
        contentType: "image/webp",
      });
      expect(result.ext).toBe("webp");
    }),
  );

  it.effect("rejects an unsupported content type", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        validateAndDecodeAvatar({
          imageBase64: toBase64(PNG_SIGNATURE),
          contentType: "image/gif",
        }),
      );
      expect(error).toBeInstanceOf(AvatarValidationError);
      expect(error.message).toContain("Unsupported image type");
    }),
  );

  it.effect("rejects malformed base64", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        validateAndDecodeAvatar({ imageBase64: "@@@not-base64@@@", contentType: "image/png" }),
      );
      expect(error).toBeInstanceOf(AvatarValidationError);
      expect(error.message).toContain("base64");
    }),
  );

  it.effect("rejects bytes that do not match the declared type (magic-byte sniff)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        validateAndDecodeAvatar({
          imageBase64: toBase64([0x00, 0x01, 0x02, 0x03]),
          contentType: "image/png",
        }),
      );
      expect(error).toBeInstanceOf(AvatarValidationError);
      expect(error.message).toContain("does not match");
    }),
  );

  it.effect("rejects an oversized image", () =>
    Effect.gen(function* () {
      const tooBig = new Uint8Array(MAX_AVATAR_BYTES + 1);
      tooBig.set(PNG_SIGNATURE, 0);
      const error = yield* Effect.flip(
        validateAndDecodeAvatar({
          imageBase64: Buffer.from(tooBig).toString("base64"),
          contentType: "image/png",
        }),
      );
      expect(error).toBeInstanceOf(AvatarValidationError);
      expect(error.message).toContain("too large");
    }),
  );
});

describe("avatarSha256Hex", () => {
  it.effect("returns a deterministic 64-char lowercase hex digest", () =>
    Effect.gen(function* () {
      const bytes = Uint8Array.from([1, 2, 3, 4]);
      const a = yield* avatarSha256Hex(bytes);
      const b = yield* avatarSha256Hex(Uint8Array.from([1, 2, 3, 4]));
      expect(a).toMatch(/^[0-9a-f]{64}$/);
      expect(a).toBe(b);
    }),
  );

  it.effect("differs for different inputs", () =>
    Effect.gen(function* () {
      const a = yield* avatarSha256Hex(Uint8Array.from([1]));
      const b = yield* avatarSha256Hex(Uint8Array.from([2]));
      expect(a).not.toBe(b);
    }),
  );
});

describe("deriveAvatarKey / URL helpers", () => {
  it("builds a content-addressed key", () => {
    expect(deriveAvatarKey("organization", "org_1", "abc123", "webp")).toBe(
      "avatars/organization/org_1/abc123.webp",
    );
    expect(deriveAvatarKey("project", "proj_1", "def456", "png")).toBe(
      "avatars/project/proj_1/def456.png",
    );
  });

  it("recognises our own avatar URLs and ignores foreign/null ones", () => {
    const base = "https://api.voidhash.com";
    expect(isOwnedAvatarUrl(`${base}/files/avatars/x`, base)).toBe(true);
    expect(isOwnedAvatarUrl("https://workos.example/avatar.png", base)).toBe(false);
    expect(isOwnedAvatarUrl(null, base)).toBe(false);
  });

  it("extracts the object key from one of our URLs, else null", () => {
    const base = "https://api.voidhash.com";
    expect(avatarKeyFromUrl(`${base}/files/avatars/organization/org_1/x.webp`, base)).toBe(
      "avatars/organization/org_1/x.webp",
    );
    expect(avatarKeyFromUrl("https://workos.example/avatar.png", base)).toBeNull();
  });
});

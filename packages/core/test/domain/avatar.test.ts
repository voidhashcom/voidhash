import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  AvatarValidationError,
  MAX_AVATAR_BYTES,
  avatarKeyFromUrl,
  avatarSha256Hex,
  deriveAvatarKey,
  isOwnedAvatarUrl,
  validateAndDecodeAvatar,
} from "../../src/domain/avatar.ts";

const toBase64 = (bytes: number[]): string =>
  Buffer.from(Uint8Array.from(bytes)).toString("base64");

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
// "RIFF" <4-byte length> "WEBP"
const WEBP_SIGNATURE = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect);
const runError = <A, E>(effect: Effect.Effect<A, E>): Promise<E> =>
  Effect.runPromise(Effect.flip(effect));

describe("validateAndDecodeAvatar", () => {
  it("accepts a PNG and returns the png extension", async () => {
    const result = await run(
      validateAndDecodeAvatar({ imageBase64: toBase64(PNG_SIGNATURE), contentType: "image/png" }),
    );
    expect(result.ext).toBe("png");
    expect([...result.bytes.slice(0, 8)]).toEqual(PNG_SIGNATURE);
  });

  it("accepts a JPEG and returns the jpg extension", async () => {
    const result = await run(
      validateAndDecodeAvatar({ imageBase64: toBase64(JPEG_SIGNATURE), contentType: "image/jpeg" }),
    );
    expect(result.ext).toBe("jpg");
  });

  it("accepts a WebP and returns the webp extension", async () => {
    const result = await run(
      validateAndDecodeAvatar({ imageBase64: toBase64(WEBP_SIGNATURE), contentType: "image/webp" }),
    );
    expect(result.ext).toBe("webp");
  });

  it("rejects an unsupported content type", async () => {
    const error = await runError(
      validateAndDecodeAvatar({ imageBase64: toBase64(PNG_SIGNATURE), contentType: "image/gif" }),
    );
    expect(error).toBeInstanceOf(AvatarValidationError);
    expect(error.message).toContain("Unsupported image type");
  });

  it("rejects malformed base64", async () => {
    const error = await runError(
      validateAndDecodeAvatar({ imageBase64: "@@@not-base64@@@", contentType: "image/png" }),
    );
    expect(error).toBeInstanceOf(AvatarValidationError);
    expect(error.message).toContain("base64");
  });

  it("rejects bytes that do not match the declared type (magic-byte sniff)", async () => {
    const error = await runError(
      validateAndDecodeAvatar({
        imageBase64: toBase64([0x00, 0x01, 0x02, 0x03]),
        contentType: "image/png",
      }),
    );
    expect(error).toBeInstanceOf(AvatarValidationError);
    expect(error.message).toContain("does not match");
  });

  it("rejects an oversized image", async () => {
    const tooBig = new Uint8Array(MAX_AVATAR_BYTES + 1);
    tooBig.set(PNG_SIGNATURE, 0);
    const error = await runError(
      validateAndDecodeAvatar({
        imageBase64: Buffer.from(tooBig).toString("base64"),
        contentType: "image/png",
      }),
    );
    expect(error).toBeInstanceOf(AvatarValidationError);
    expect(error.message).toContain("too large");
  });
});

describe("avatarSha256Hex", () => {
  it("returns a deterministic 64-char lowercase hex digest", async () => {
    const bytes = Uint8Array.from([1, 2, 3, 4]);
    const a = await run(avatarSha256Hex(bytes));
    const b = await run(avatarSha256Hex(Uint8Array.from([1, 2, 3, 4])));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
  });

  it("differs for different inputs", async () => {
    const a = await run(avatarSha256Hex(Uint8Array.from([1])));
    const b = await run(avatarSha256Hex(Uint8Array.from([2])));
    expect(a).not.toBe(b);
  });
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

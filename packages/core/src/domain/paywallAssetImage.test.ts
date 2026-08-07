import { Effect, Encoding, Result } from "effect";

import { describe, expect, it } from "../testing/effect-vitest.ts";

import {
  MAX_PAYWALL_ASSET_BYTES,
  PaywallAssetValidationError,
  derivePaywallAssetKey,
  isOwnedPaywallAssetUrl,
  paywallAssetKeyFromUrl,
  paywallAssetSha256Hex,
  validateAndDecodePaywallAsset,
} from "./paywallAssetImage.ts";

const toBase64 = (bytes: readonly number[]): string => Encoding.encodeBase64(new Uint8Array(bytes));

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0x00];
const GIF_MAGIC = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00];

const runExit = <A, E>(effect: Effect.Effect<A, E>) => Effect.runSync(Effect.result(effect));

describe("validateAndDecodePaywallAsset", () => {
  it("accepts a well-formed PNG and returns bytes + ext", () => {
    const result = runExit(
      validateAndDecodePaywallAsset({
        imageBase64: toBase64(PNG_MAGIC),
        contentType: "image/png",
      }),
    );
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.ext).toBe("png");
      expect(result.success.bytes.length).toBe(PNG_MAGIC.length);
    }
  });

  it("accepts a PNG sent as a `data:` URL (the AI-chat composer's readAsDataURL path)", () => {
    // The chat composer sends the full `data:image/png;base64,...` URL (prefix
    // kept), so the decoder must strip the prefix before `atob`. Feeding the
    // prefix straight into `atob` misaligns the decode and the magic-byte sniff
    // then fails with "Image data does not match its declared type".
    const dataUrl = `data:image/png;base64,${toBase64(PNG_MAGIC)}`;
    const result = runExit(
      validateAndDecodePaywallAsset({ imageBase64: dataUrl, contentType: "image/png" }),
    );
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.ext).toBe("png");
      expect(result.success.bytes.length).toBe(PNG_MAGIC.length);
    }
  });

  it("accepts GIF (extended allowlist)", () => {
    const result = runExit(
      validateAndDecodePaywallAsset({
        imageBase64: toBase64(GIF_MAGIC),
        contentType: "image/gif",
      }),
    );
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.ext).toBe("gif");
    }
  });

  it("rejects an unsupported content type", () => {
    const result = runExit(
      validateAndDecodePaywallAsset({ imageBase64: toBase64(PNG_MAGIC), contentType: "image/svg+xml" }),
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(PaywallAssetValidationError);
    }
  });

  it("rejects bytes that do not match the declared type", () => {
    const result = runExit(
      validateAndDecodePaywallAsset({ imageBase64: toBase64(JPEG_MAGIC), contentType: "image/png" }),
    );
    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects an oversized payload from the base64 length pre-check", () => {
    // Build a base64 string whose decoded length exceeds the cap without
    // allocating the decoded buffer (the pre-check trips first).
    const oversizedBase64 = "A".repeat(Math.ceil(((MAX_PAYWALL_ASSET_BYTES + 1024) * 4) / 3));
    const result = runExit(
      validateAndDecodePaywallAsset({ imageBase64: oversizedBase64, contentType: "image/png" }),
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.message).toContain("too large");
    }
  });

  it("rejects an empty image", () => {
    const result = runExit(
      validateAndDecodePaywallAsset({ imageBase64: "", contentType: "image/png" }),
    );
    expect(Result.isFailure(result)).toBe(true);
  });
});

describe("derivePaywallAssetKey", () => {
  it("is content-addressed and org-scoped", () => {
    expect(derivePaywallAssetKey("org_1", "deadbeef", "png")).toBe(
      "paywall-assets/org_1/deadbeef.png",
    );
  });
});

describe("paywallAssetSha256Hex", () => {
  it.effect("is deterministic for identical bytes (dedup foundation)", () =>
    Effect.gen(function* () {
      const a = yield* paywallAssetSha256Hex(new Uint8Array(PNG_MAGIC));
      const b = yield* paywallAssetSha256Hex(new Uint8Array(PNG_MAGIC));
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    }),
  );
});

describe("ownership guards", () => {
  const base = "https://files.example.com";

  it("only owns URLs under our store scoped to the org", () => {
    const owned = `${base}/files/paywall-assets/org_1/abc.png`;
    expect(isOwnedPaywallAssetUrl(owned, "org_1", base)).toBe(true);
    // Another org's object is not owned by org_1.
    expect(isOwnedPaywallAssetUrl(`${base}/files/paywall-assets/org_2/abc.png`, "org_1", base)).toBe(
      false,
    );
    // External URL is never owned.
    expect(isOwnedPaywallAssetUrl("https://cdn.other.com/x.png", "org_1", base)).toBe(false);
    expect(isOwnedPaywallAssetUrl(null, "org_1", base)).toBe(false);
  });

  it("extracts the key only for own, org-scoped URLs", () => {
    const owned = `${base}/files/paywall-assets/org_1/abc.png`;
    expect(paywallAssetKeyFromUrl(owned, "org_1", base)).toBe("paywall-assets/org_1/abc.png");
    expect(paywallAssetKeyFromUrl(owned, "org_2", base)).toBe(null);
    expect(paywallAssetKeyFromUrl("https://cdn.other.com/x.png", "org_1", base)).toBe(null);
  });
});

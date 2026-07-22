import { describe, expect, it } from "vite-plus/test";

import {
  derivePaywallThumbnailKey,
  isOwnedPaywallThumbnailUrl,
  paywallThumbnailKeyFromUrl,
} from "./paywallThumbnail.ts";

describe("derivePaywallThumbnailKey", () => {
  it("is a stable project- and paywall-scoped key", () => {
    expect(derivePaywallThumbnailKey("proj_1", "pw_1")).toBe(
      "paywall-thumbnails/proj_1/pw_1/thumbnail.png",
    );
  });
});

describe("thumbnail ownership guards", () => {
  const base = "https://files.example.com";

  it("only owns URLs under our store scoped to the project + paywall", () => {
    const owned = `${base}/files/paywall-thumbnails/proj_1/pw_1/3.png`;
    expect(isOwnedPaywallThumbnailUrl(owned, "proj_1", "pw_1", base)).toBe(true);
    // Another paywall's object is not owned by pw_1.
    expect(
      isOwnedPaywallThumbnailUrl(
        `${base}/files/paywall-thumbnails/proj_1/pw_2/3.png`,
        "proj_1",
        "pw_1",
        base,
      ),
    ).toBe(false);
    // Another project's object is not owned.
    expect(
      isOwnedPaywallThumbnailUrl(
        `${base}/files/paywall-thumbnails/proj_2/pw_1/3.png`,
        "proj_1",
        "pw_1",
        base,
      ),
    ).toBe(false);
    // External URL is never owned.
    expect(isOwnedPaywallThumbnailUrl("https://cdn.other.com/x.png", "proj_1", "pw_1", base)).toBe(
      false,
    );
    expect(isOwnedPaywallThumbnailUrl(null, "proj_1", "pw_1", base)).toBe(false);
  });

  it("extracts the key only for own, project+paywall-scoped URLs", () => {
    const owned = `${base}/files/paywall-thumbnails/proj_1/pw_1/thumbnail.png?v=3`;
    expect(paywallThumbnailKeyFromUrl(owned, "proj_1", "pw_1", base)).toBe(
      "paywall-thumbnails/proj_1/pw_1/thumbnail.png",
    );
    expect(paywallThumbnailKeyFromUrl(owned, "proj_1", "pw_2", base)).toBe(null);
    expect(paywallThumbnailKeyFromUrl(owned, "proj_2", "pw_1", base)).toBe(null);
    expect(paywallThumbnailKeyFromUrl("https://cdn.other.com/x.png", "proj_1", "pw_1", base)).toBe(
      null,
    );
  });
});

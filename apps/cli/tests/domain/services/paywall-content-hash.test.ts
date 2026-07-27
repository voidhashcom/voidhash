import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  computeComponentContentHash,
  computePaywallContentHash,
  sha256Hex,
} from "../../../src/domain/services/paywall-build";

const digest = (input: string): string => createHash("sha256").update(input).digest("hex");

const h = sha256Hex("html");
const j = sha256Hex("js");
const m = sha256Hex("manifest");
const r = sha256Hex("runtime");
const p = sha256Hex("panel");
const a1 = sha256Hex("asset-1");
const a2 = sha256Hex("asset-2");

describe("computePaywallContentHash", () => {
  it("hashes html:js:sortedAssets per contract §1.2", () => {
    const sorted = [a1, a2].sort();
    expect(
      computePaywallContentHash({
        assetSha256s: [a1, a2],
        htmlSha256: h,
        jsSha256: j,
      }),
    ).toBe(digest(`${h}:${j}:${sorted.join(":")}`));
  });

  it("sorts asset hashes before joining", () => {
    const forward = computePaywallContentHash({
      assetSha256s: [a1, a2],
      htmlSha256: h,
      jsSha256: j,
    });
    const reversed = computePaywallContentHash({
      assetSha256s: [a2, a1],
      htmlSha256: h,
      jsSha256: j,
    });
    expect(forward).toBe(reversed);
  });

  it("keeps the trailing separator when there are no assets", () => {
    expect(
      computePaywallContentHash({
        assetSha256s: [],
        htmlSha256: h,
        jsSha256: j,
      }),
    ).toBe(digest(`${h}:${j}:`));
  });
});

describe("computeComponentContentHash", () => {
  it("hashes manifest:runtime:panel:sortedPreviews per contract §1.2", () => {
    const sorted = [a1, a2].sort();
    expect(
      computeComponentContentHash({
        manifestSha256: m,
        panelSha256: p,
        previewSha256s: [a2, a1],
        runtimeSha256: r,
      }),
    ).toBe(digest(`${m}:${r}:${p}:${sorted.join(":")}`));
  });

  it("uses the empty string for an absent panel", () => {
    const expected = digest(`${m}:${r}::${a1}`);
    expect(
      computeComponentContentHash({
        manifestSha256: m,
        panelSha256: null,
        previewSha256s: [a1],
        runtimeSha256: r,
      }),
    ).toBe(expected);
    expect(
      computeComponentContentHash({
        manifestSha256: m,
        previewSha256s: [a1],
        runtimeSha256: r,
      }),
    ).toBe(expected);
  });

  it("distinguishes panel-less and panel-bearing builds", () => {
    const without = computeComponentContentHash({
      manifestSha256: m,
      panelSha256: null,
      previewSha256s: [a1],
      runtimeSha256: r,
    });
    const withPanel = computeComponentContentHash({
      manifestSha256: m,
      panelSha256: p,
      previewSha256s: [a1],
      runtimeSha256: r,
    });
    expect(without).not.toBe(withPanel);
  });
});

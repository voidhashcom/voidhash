import { describe, expect, it } from "vitest";

import {
  definitionHasPanel,
  PANEL_SANDBOX_EXTERNALS,
} from "../../../src/domain/services/paywall-build";

describe("definitionHasPanel", () => {
  it("is true only for a live panel FUNCTION (matching the browser pipeline)", () => {
    expect(definitionHasPanel({ panel: () => null })).toBe(true);
  });

  it("is false for a present-but-non-function panel, or an absent one", () => {
    // A JSX element / object is NOT a panel function — the browser sandbox's
    // `definitionHasPanel` (`typeof panel === "function"`) also rejects these.
    expect(definitionHasPanel({ panel: { type: "panel" } })).toBe(false);
    expect(definitionHasPanel({ panel: null })).toBe(false);
    expect(definitionHasPanel({ panel: undefined })).toBe(false);
    expect(definitionHasPanel({})).toBe(false);
  });
});

describe("PANEL_SANDBOX_EXTERNALS", () => {
  it("mirrors the studio panel sandbox require-shim module keys one-for-one", () => {
    // Source of truth: `@voidhash/paywalls/sandbox`'s `modules` map keys (the
    // specifiers the panel sandbox's require shim resolves). A panel bundle
    // must leave EXACTLY these external so the shim satisfies every require and
    // no second React/SDK instance is bundled.
    expect([...PANEL_SANDBOX_EXTERNALS].sort()).toEqual(
      [
        "@voidhash/paywalls",
        "@voidhash/paywalls/jsx-dev-runtime",
        "@voidhash/paywalls/jsx-runtime",
        "@voidhash/paywalls/panel",
        "react",
        "react/jsx-dev-runtime",
        "react/jsx-runtime",
      ].sort(),
    );
  });
});

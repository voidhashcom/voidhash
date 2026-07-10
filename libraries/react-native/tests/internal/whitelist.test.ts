import { compileWhitelist, passesWhitelist } from "../../src/internal/webview/whitelist";
import { describe, expect, it } from "../helpers/effect-vitest";

describe("webview whitelist", () => {
  it("allows whitelisted https origin", () => {
    const compiled = compileWhitelist(["https://*.voidhash.com"]);
    expect(passesWhitelist(compiled, "https://pay.voidhash.com/checkout")).toBe(true);
  });

  it("blocks non-whitelisted origin", () => {
    const compiled = compileWhitelist(["https://*.voidhash.com"]);
    expect(passesWhitelist(compiled, "https://example.com")).toBe(false);
  });

  it("blocks origin that only matches as prefix", () => {
    const compiled = compileWhitelist(["https://*.voidhash.com"]);
    expect(passesWhitelist(compiled, "https://pay.voidhash.com.evil.tld")).toBe(false);
  });
});

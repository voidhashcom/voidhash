import { describe, expect, it } from "../helpers/effect-vitest";
import {
  normalizeSource,
  wrapNitroCallback,
} from "../../src/internal/webview/utils";

describe("webview utils", () => {
  it("wraps callbacks in Nitro callback object", () => {
    const callback = () => true;
    const wrapped = wrapNitroCallback(callback);

    expect(wrapped).toEqual({ f: callback });
  });

  it("normalizes source headers object to array", () => {
    const normalized = normalizeSource({
      headers: {
        Authorization: "Bearer token",
        "X-Test": "value",
      },
      uri: "https://example.com",
    });

    expect(normalized?.headers).toEqual([
      { name: "Authorization", value: "Bearer token" },
      { name: "X-Test", value: "value" },
    ]);
  });
});

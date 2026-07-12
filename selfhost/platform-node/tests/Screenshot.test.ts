import { ScreenshotError } from "@voidhash/platform/Screenshot";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { validateChromiumScreenshotOptions } from "../src/Screenshot.ts";

const normalScreenshot = {
  deviceScaleFactor: 2,
  height: 812,
  html: "<!doctype html><p>Paywall</p>",
  width: 375,
};

describe("Chromium screenshot budgets", () => {
  it("accepts a normal phone-sized render", async () => {
    await expect(
      Effect.runPromise(validateChromiumScreenshotOptions(normalScreenshot, {})),
    ).resolves.toBeUndefined();
  });

  it("rejects HTML over the configured byte budget", async () => {
    const error = await Effect.runPromise(
      validateChromiumScreenshotOptions(
        { ...normalScreenshot, html: "12345" },
        { maxHtmlBytes: 4 },
      ).pipe(Effect.flip),
    );
    expect(error).toBeInstanceOf(ScreenshotError);
    expect(error.operation).toBe("validate");
  });

  it("rejects a viewport and scale combination over the pixel budget", async () => {
    const error = await Effect.runPromise(
      validateChromiumScreenshotOptions(
        { ...normalScreenshot, deviceScaleFactor: 4, height: 4_096, width: 4_096 },
        {},
      ).pipe(Effect.flip),
    );
    expect(error).toBeInstanceOf(ScreenshotError);
    expect(error.operation).toBe("validate");
  });
});

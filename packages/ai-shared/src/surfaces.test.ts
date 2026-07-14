import { describe, expect, it } from "vite-plus/test";

import { previewScreenshotToolResultSchema } from "./surfaces.ts";

describe("previewScreenshotToolResultSchema", () => {
  it("accepts a successful multimodal screenshot payload", () => {
    expect(
      previewScreenshotToolResultSchema.safeParse({
        kind: "preview-screenshot",
        mediaType: "image/png",
        dataBase64: "cG5n",
        width: 375,
        height: 812,
        scale: 1,
        documentSignature: "doc-12345678",
        message: "Review this render.",
      }).success,
    ).toBe(true);
  });

  it("accepts a recoverable capture error for the next continuation", () => {
    expect(
      previewScreenshotToolResultSchema.safeParse("Could not capture the live preview.").success,
    ).toBe(true);
  });
});

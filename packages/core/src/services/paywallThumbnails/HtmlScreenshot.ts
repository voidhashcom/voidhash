import { Context, type Effect, Schema } from "effect";

/**
 * Catch-all error for {@link HtmlScreenshot} operations. The adapter wraps any
 * browser-rendering failure (Cloudflare Browser Rendering API errors, timeouts,
 * stream failures) into this single tag so service catch boundaries stay small.
 */
export class HtmlScreenshotError extends Schema.TaggedErrorClass<HtmlScreenshotError>(
  "HtmlScreenshotError",
)("HtmlScreenshotError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface HtmlScreenshotOptions {
  /** Self-contained HTML document to render (no external network dependencies). */
  readonly html: string;
  /** Viewport width in CSS pixels. */
  readonly width: number;
  /** Viewport height in CSS pixels. */
  readonly height: number;
  /** Device pixel ratio; `2` produces a crisp @2x raster for retina previews. */
  readonly deviceScaleFactor: number;
}

export interface HtmlScreenshotShape {
  /**
   * Renders an HTML document in a headless browser and returns the PNG bytes of
   * a full-viewport screenshot at the requested pixel density.
   */
  readonly screenshot: (
    options: HtmlScreenshotOptions,
  ) => Effect.Effect<Uint8Array, HtmlScreenshotError>;
}

/**
 * Provider-agnostic port for rasterizing an HTML document to a PNG. The live
 * adapter (Cloudflare Browser Rendering, `stacks/backend/infrastructure/HtmlScreenshot.ts`)
 * is wired by the application root — core code only touches the tag, keeping the
 * browser SDK out of `packages/core` and the port trivially fakeable in tests.
 */
export class HtmlScreenshot extends Context.Service<HtmlScreenshot, HtmlScreenshotShape>()(
  "infrastructure/HtmlScreenshot",
) {}

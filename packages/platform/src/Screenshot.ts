import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { PlatformRuntime } from "./PlatformRuntime.ts";

/** Stable failure raised by an HTML screenshot adapter. */
export class ScreenshotError extends Schema.TaggedErrorClass<ScreenshotError>("ScreenshotError")(
  "ScreenshotError",
  {
    cause: Schema.String,
    operation: Schema.String,
  },
) {}

/** Viewport and document input for a PNG screenshot. */
export interface ScreenshotOptions {
  readonly html: string;
  readonly width: number;
  readonly height: number;
  readonly deviceScaleFactor: number;
}

/** Provider-neutral HTML screenshot capabilities. */
export interface ScreenshotShape {
  readonly renderPng: (
    options: ScreenshotOptions,
  ) => Effect.Effect<Uint8Array, ScreenshotError, PlatformRuntime>;
}

/** Provider-neutral renderer for self-contained HTML documents. */
export class Screenshot extends Context.Service<Screenshot, ScreenshotShape>()(
  "@voidhash/platform/Screenshot",
) {}

import { Effect, Schema } from "effect";

import { AnalyticsCapture, CaptureRequest } from "../../application/Capture.ts";

/** Decode transport input before invoking the analytics capture service. */
export const captureHandler = (input: unknown) =>
  Schema.decodeUnknownEffect(CaptureRequest)(input).pipe(
    Effect.flatMap((request) =>
      AnalyticsCapture.pipe(Effect.flatMap((capture) => capture.capture(request))),
    ),
  );

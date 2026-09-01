import * as Schema from "effect/Schema";

/** A dependency failure reported through an analytics port. */
export class AnalyticsPortError extends Schema.TaggedErrorClass<AnalyticsPortError>()(
  "AnalyticsPortError",
  {
    /** The original failure, retained for logging and diagnostics. */
    cause: Schema.Unknown,
    /** A safe summary of the failed port operation. */
    message: Schema.String,
  },
) {}

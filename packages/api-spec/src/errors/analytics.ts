import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic analytics service error */
export class AnalyticsServiceError extends Schema.TaggedError<AnalyticsServiceError>()(
  "AnalyticsServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** Invalid time range error */
export class InvalidTimeRangeError extends Schema.TaggedError<InvalidTimeRangeError>()(
  "InvalidTimeRangeError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 400 })
) {}

/** Invalid metric error */
export class InvalidMetricError extends Schema.TaggedError<InvalidMetricError>()(
  "InvalidMetricError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 400 })
) {}

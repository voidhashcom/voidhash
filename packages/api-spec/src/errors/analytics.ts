import { Schema } from "effect";

/** Generic analytics service error */
export class AnalyticsServiceError extends Schema.TaggedErrorClass<AnalyticsServiceError>()(
  "AnalyticsServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** Invalid time range error */
export class InvalidTimeRangeError extends Schema.TaggedErrorClass<InvalidTimeRangeError>()(
  "InvalidTimeRangeError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 }
) {}

/** Invalid metric error */
export class InvalidMetricError extends Schema.TaggedErrorClass<InvalidMetricError>()(
  "InvalidMetricError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 }
) {}

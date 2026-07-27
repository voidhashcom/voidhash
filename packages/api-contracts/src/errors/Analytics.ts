import { Schema } from "effect";

/** Generic analytics service error */
export class ApiAnalyticsServiceError extends Schema.TaggedErrorClass<ApiAnalyticsServiceError>()(
  "Api/AnalyticsServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Invalid time range error */
export class ApiInvalidTimeRangeError extends Schema.TaggedErrorClass<ApiInvalidTimeRangeError>()(
  "Api/InvalidTimeRangeError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}

/** Invalid metric error */
export class ApiInvalidMetricError extends Schema.TaggedErrorClass<ApiInvalidMetricError>()(
  "Api/InvalidMetricError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}

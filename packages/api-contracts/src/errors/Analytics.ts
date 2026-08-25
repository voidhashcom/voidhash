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

/**
 * The requested `insightId` is not in the built-in catalogue. 422 rather than
 * 404: the request URL exists, it is the body that names something unknown.
 */
export class ApiUnknownInsightError extends Schema.TaggedErrorClass<ApiUnknownInsightError>()(
  "Api/UnknownInsightError",
  {
    insightId: Schema.String,
    message: Schema.String,
  },
  { httpApiStatus: 422 },
) {}

/**
 * The event admission policy could not be written. The service reports an
 * unknown built-in key, a reserved (`$`-prefixed) custom event name, and a
 * storage failure under one tag, so this maps to 400 — the overwhelmingly
 * common cause is a bad key or event name in the request.
 */
export class ApiEventAdmissionError extends Schema.TaggedErrorClass<ApiEventAdmissionError>()(
  "Api/EventAdmissionError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}

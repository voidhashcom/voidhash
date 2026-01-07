import { Schema } from "effect";

export class AnalyticsServiceError extends Schema.TaggedError<AnalyticsServiceError>()(
  "AnalyticsServiceError",
  {
    cause: Schema.String,
  }
) {}

export class InvalidTimeRangeError extends Schema.TaggedError<InvalidTimeRangeError>()(
  "InvalidTimeRangeError",
  {
    message: Schema.String,
  }
) {
  toString(): string {
    return `Invalid time range: ${this.message}`;
  }
}

export class InvalidMetricError extends Schema.TaggedError<InvalidMetricError>()(
  "InvalidMetricError",
  {
    message: Schema.String,
    metric: Schema.String,
  }
) {
  toString(): string {
    return `Invalid metric '${this.metric}': ${this.message}`;
  }
}

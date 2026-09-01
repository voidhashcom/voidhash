import type {
  CaptureDependencyUnavailableError,
  CaptureInternalServerError,
  CaptureInvalidRequestError,
  CapturePayloadTooLargeError,
  CaptureRateLimitedError,
  CaptureUnauthorizedError,
  EventCaptureBatchRequest,
  EventCaptureCaptureRequest,
} from "./generated";
import type * as Schema from "effect/Schema";

export * from "./generated";

export type CaptureBatchRequest = EventCaptureBatchRequest;
export type CaptureErrorResponse =
  | CaptureDependencyUnavailableError
  | CaptureInternalServerError
  | CaptureInvalidRequestError
  | CapturePayloadTooLargeError
  | CaptureRateLimitedError
  | CaptureUnauthorizedError;
export type CaptureEvent = EventCaptureBatchRequest["events"][number];
export type CaptureSingleRequest = EventCaptureCaptureRequest;
export type EventContextField = Schema.Json;
export type EventPropertiesField = Schema.Json;

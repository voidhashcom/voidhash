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
export type EventContextField =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<EventContextField>
  | { readonly [key: string]: EventContextField };
export type EventPropertiesField =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<EventPropertiesField>
  | { readonly [key: string]: EventPropertiesField };

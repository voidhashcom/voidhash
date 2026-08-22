import type {
  CaptureAcceptedResponseJsonEncoding,
  CaptureDependencyUnavailableErrorJsonEncoding,
  CaptureInternalServerErrorJsonEncoding,
  CaptureInvalidRequestErrorJsonEncoding,
  CapturePayloadTooLargeErrorJsonEncoding,
  CaptureRateLimitedErrorJsonEncoding,
  CaptureUnauthorizedErrorJsonEncoding,
  EventCaptureBatchRequest,
  EventCaptureCaptureRequest,
} from "./generated";

export * from "./generated";

export type CaptureAcceptedResponse = CaptureAcceptedResponseJsonEncoding;
export type CaptureBatchRequest = EventCaptureBatchRequest;
export type CaptureErrorResponse =
  | CaptureDependencyUnavailableErrorJsonEncoding
  | CaptureInternalServerErrorJsonEncoding
  | CaptureInvalidRequestErrorJsonEncoding
  | CapturePayloadTooLargeErrorJsonEncoding
  | CaptureRateLimitedErrorJsonEncoding
  | CaptureUnauthorizedErrorJsonEncoding;
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

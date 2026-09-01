import * as Schema from "effect/Schema";
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

const CaptureErrorResponseFields = {
  error: Schema.NonEmptyString,
};

/**
 * Accepts an ISO 8601 string from JSON input and decodes it to a valid `Date`.
 */
const DateValidFromString = Schema.DateFromString;

// export { CaptureAcceptedResponse, CaptureBatchRequest, CaptureErrorCode, CaptureErrorResponse };
// export { CaptureEvent, CaptureSdkRequestMetadata };
export const EventPropertiesField = Schema.Json;
export type EventPropertiesField = typeof EventPropertiesField.Type;
export const EventProperties = Schema.Record(Schema.String, EventPropertiesField);
export type EventProperties = typeof EventProperties.Type;

export const EventContextField = Schema.Json;
export type EventContextField = typeof EventContextField.Type;
export const EventContext = Schema.Record(Schema.String, EventContextField);
export type EventContext = typeof EventContext.Type;

export const CaptureEvent = Schema.Struct({
  uuid: Schema.NonEmptyString,
  event: Schema.NonEmptyString,
  context: EventContext,
  properties: EventProperties,
  distinct_id: Schema.NonEmptyString,
  session_id: Schema.optional(Schema.NonEmptyString),
  timestamp: DateValidFromString,
});
export type CaptureEvent = typeof CaptureEvent.Type;

/**
 * The project credential authorizing the capture.
 *
 * Optional in the body because server-side callers may instead present a
 * project secret key through the `x-secret-key` header, the convention every
 * other Voidhash API uses. Exactly one of the two must be supplied; the request
 * is rejected with `unauthorized` when neither is. Only publishable tokens are
 * accepted here — a secret key in the body is rejected with `unauthorized`
 * because this field is what distributed clients ship.
 */
const CaptureToken = Schema.optional(Schema.NonEmptyString);

/**
 * Header form of the capture credential, for server-side callers.
 *
 * Optional because browser and mobile SDKs authorize through the body `token`
 * instead. Declared on the endpoint so it shows up as a documented parameter in
 * the generated OpenAPI document and the SDKs generated from it.
 *
 * Deliberately a plain `String`: endpoint headers are decoded before the
 * handler runs, so a `NonEmptyString` would turn a present-but-empty header
 * (an unset env var interpolated by a caller) into an empty-body schema 400
 * instead of the uniform `unauthorized` 401 the capture service answers.
 */
const CaptureAuthHeaders = Schema.Struct({
  "x-secret-key": Schema.optional(Schema.String),
});

export const CaptureSingleRequest = Schema.Struct({
  ...CaptureEvent.fields,
  sent_at: DateValidFromString,
  token: CaptureToken,
});
export type CaptureSingleRequest = typeof CaptureSingleRequest.Type;

export const CaptureBatchRequest = Schema.Struct({
  events: Schema.NonEmptyArray(CaptureEvent),
  sent_at: DateValidFromString,
  token: CaptureToken,
});
export type CaptureBatchRequest = typeof CaptureBatchRequest.Type;

export class CaptureAcceptedResponse extends Schema.Class<CaptureAcceptedResponse>(
  "CaptureAcceptedResponse",
)({
  accepted: Schema.Int,
  rejected: Schema.Int,
}) {}

const CaptureAcceptedApiResponse = CaptureAcceptedResponse.pipe(HttpApiSchema.status(202));

export class CaptureInvalidRequestError extends Schema.TaggedErrorClass<CaptureInvalidRequestError>()(
  "CaptureInvalidRequestError",
  {
    ...CaptureErrorResponseFields,
    code: Schema.Literal("invalid_request"),
  },
  { httpApiStatus: 400 },
) {}

export class CaptureUnauthorizedError extends Schema.TaggedErrorClass<CaptureUnauthorizedError>()(
  "CaptureUnauthorizedError",
  {
    ...CaptureErrorResponseFields,
    code: Schema.Literal("unauthorized"),
  },
  { httpApiStatus: 401 },
) {}

export class CapturePayloadTooLargeError extends Schema.TaggedErrorClass<CapturePayloadTooLargeError>()(
  "CapturePayloadTooLargeError",
  {
    ...CaptureErrorResponseFields,
    code: Schema.Literal("payload_too_large"),
  },
  { httpApiStatus: 413 },
) {}

export class CaptureRateLimitedError extends Schema.TaggedErrorClass<CaptureRateLimitedError>()(
  "CaptureRateLimitedError",
  {
    ...CaptureErrorResponseFields,
    code: Schema.Literal("rate_limited"),
    retry_after_ms: Schema.optional(Schema.Int),
  },
  { httpApiStatus: 429 },
) {}

export class CaptureDependencyUnavailableError extends Schema.TaggedErrorClass<CaptureDependencyUnavailableError>()(
  "CaptureDependencyUnavailableError",
  {
    ...CaptureErrorResponseFields,
    code: Schema.Literal("dependency_unavailable"),
  },
  { httpApiStatus: 503 },
) {}

export class CaptureInternalServerError extends Schema.TaggedErrorClass<CaptureInternalServerError>()(
  "CaptureInternalServerError",
  {
    ...CaptureErrorResponseFields,
    code: Schema.Literal("internal_error"),
  },
  { httpApiStatus: 500 },
) {}

export type CaptureErrorResponse =
  | CaptureInvalidRequestError
  | CaptureUnauthorizedError
  | CapturePayloadTooLargeError
  | CaptureRateLimitedError
  | CaptureDependencyUnavailableError
  | CaptureInternalServerError;

export type CaptureErrorCode = CaptureErrorResponse["code"];

export const EventCaptureApi = HttpApi.make("EventCaptureApi").add(
  HttpApiGroup.make("event_capture")
    .add(
      HttpApiEndpoint.post("capture", "/capture", {
        error: [
          CaptureInvalidRequestError,
          CaptureUnauthorizedError,
          CapturePayloadTooLargeError,
          CaptureRateLimitedError,
          CaptureDependencyUnavailableError,
          CaptureInternalServerError,
        ],
        headers: CaptureAuthHeaders,
        payload: CaptureSingleRequest,
        success: CaptureAcceptedApiResponse,
      }),
    )
    .add(
      HttpApiEndpoint.post("batch", "/batch", {
        error: [
          CaptureInvalidRequestError,
          CaptureUnauthorizedError,
          CapturePayloadTooLargeError,
          CaptureRateLimitedError,
          CaptureDependencyUnavailableError,
          CaptureInternalServerError,
        ],
        headers: CaptureAuthHeaders,
        payload: CaptureBatchRequest,
        success: CaptureAcceptedApiResponse,
      }),
    )
    .prefix("/i/v1"),
);

export { EventProperties as EventPropertiesSchema };
export { EventContext as EventContextSchema };

import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const CaptureErrorResponseFields = {
  error: Schema.NonEmptyString,
};

// export { CaptureAcceptedResponse, CaptureBatchRequest, CaptureErrorCode, CaptureErrorResponse };
// export { CaptureEvent, CaptureSdkRequestMetadata };
export type EventPropertiesFieldPrimitive = string | number | boolean | null;
export type EventPropertiesField =
  | EventPropertiesFieldPrimitive
  | ReadonlyArray<EventPropertiesField>
  | {
      readonly [key: string]: EventPropertiesField;
    };

export const EventPropertiesField: Schema.Codec<EventPropertiesField> = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
  Schema.Array(
    Schema.suspend((): Schema.Codec<EventPropertiesField> => EventPropertiesField),
  ),
  Schema.Record(
    Schema.String,
    Schema.suspend((): Schema.Codec<EventPropertiesField> => EventPropertiesField),
  ),
]);
export const EventPropertiesSchema = Schema.Record(Schema.String, EventPropertiesField);


export type EventContextFieldPrimitive = string | number | boolean | null;
export type EventContextField =
  | EventContextFieldPrimitive
  | ReadonlyArray<EventContextField>
  | {
      readonly [key: string]: EventContextField;
    };
export const EventContextField: Schema.Codec<EventContextField> = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
  Schema.Array(
    Schema.suspend((): Schema.Codec<EventContextField> => EventContextField),
  ),
  Schema.Record(
    Schema.String,
    Schema.suspend((): Schema.Codec<EventContextField> => EventContextField),
  ),
]);
export const EventContextSchema = Schema.Record(Schema.String, EventContextField);

export const CaptureEvent = Schema.Struct({
  uuid: Schema.NonEmptyString,
  event: Schema.NonEmptyString,
  context: EventContextSchema,
  properties: EventPropertiesSchema,
  distinct_id: Schema.NonEmptyString,
  session_id: Schema.optional(Schema.NonEmptyString),
  timestamp: Schema.optional(Schema.DateValid),
});

export const CaptureSingleRequest = Schema.Struct({
  ...CaptureEvent.fields,
  sent_at: Schema.DateValid,
  token: Schema.NonEmptyString,
});

export const CaptureBatchRequest = Schema.Struct({
  events: Schema.NonEmptyArray(CaptureEvent),
  sent_at: Schema.DateValid,
  token: Schema.NonEmptyString,
});

export class CaptureAcceptedResponse extends Schema.Class<CaptureAcceptedResponse>(
  "CaptureAcceptedResponse",
)({
  accepted: Schema.Int,
  rejected: Schema.Int,
}) {
  httpApiStatus = 202;
}
// export const CaptureAcceptedApiResponse = CaptureAcceptedResponse.pipe(HttpApiSchema.status(202));

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
        payload: CaptureSingleRequest,
        success: CaptureAcceptedResponse,
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
        payload: CaptureBatchRequest,
        success: CaptureAcceptedResponse,
      }),
    ),
);

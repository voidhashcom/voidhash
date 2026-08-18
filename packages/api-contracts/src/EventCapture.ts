import { Schema, SchemaTransformation } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

const CaptureErrorResponseFields = {
  error: Schema.NonEmptyString,
};

/**
 * Accepts an ISO 8601 string from JSON input and decodes it to a valid `Date`.
 * Required because `Schema.DateValid` only accepts `Date` instances; in
 * `effect@4.0.0-beta.23`, `HttpApi` does not automatically apply
 * `toCodecJson`, so JSON dates arrive as strings and fail the `instanceof Date`
 * check.
 */
const DateValidFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.DateValid,
    SchemaTransformation.transform({
      decode: (s: string) => new globalThis.Date(s),
      encode: (d: globalThis.Date) => d.toISOString(),
    }),
  ),
);

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
  Schema.Array(Schema.suspend((): Schema.Codec<EventPropertiesField> => EventPropertiesField)),
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
  Schema.Array(Schema.suspend((): Schema.Codec<EventContextField> => EventContextField)),
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
  timestamp: Schema.optional(DateValidFromString),
});

export const CaptureSingleRequest = Schema.Struct({
  ...CaptureEvent.fields,
  sent_at: DateValidFromString,
  token: Schema.NonEmptyString,
});

export const CaptureBatchRequest = Schema.Struct({
  events: Schema.NonEmptyArray(CaptureEvent),
  sent_at: DateValidFromString,
  token: Schema.NonEmptyString,
});

/** Stable reasons a record can be permanently rejected by ingestion. */
export const CaptureRecordRejectionReason = Schema.Literals([
  "malformed_envelope",
  "unsupported_schema_version",
  "payload_too_large",
  "invalid_project_scope",
  "duplicate",
  "invalid_context",
  "reserved_event",
  "policy_rejected",
]);

export type CaptureRecordRejectionReason = typeof CaptureRecordRejectionReason.Type;

/** A single record that was not accepted by the capture pipeline. */
export class CaptureRejectedRecord extends Schema.Class<CaptureRejectedRecord>(
  "CaptureRejectedRecord",
)({
  recordId: Schema.NonEmptyString,
  reason: CaptureRecordRejectionReason,
}) {}

export class CaptureAcceptedResponse extends Schema.Class<CaptureAcceptedResponse>(
  "CaptureAcceptedResponse",
)({
  accepted: Schema.Array(Schema.NonEmptyString),
  rejected: Schema.Array(CaptureRejectedRecord),
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

/** Purposes accepted by the isolated protected-evidence vault. */
export const ProtectedEvidencePurpose = Schema.Literals([
  "advertising-identifier",
  "diagnostic-authorization",
  "email",
  "install-referrer",
  "link-capture",
  "partner-context",
  "phone",
  "purchase-receipt",
  "push-token",
]);

export const ProtectedEvidenceRetentionClass = Schema.Literals([
  "ephemeral",
  "installation",
  "legal",
  "transaction",
]);

export const ProtectedEvidenceDeletionState = Schema.Literals([
  "active",
  "deletion-requested",
  "deleted",
]);

/** Encrypted evidence uploaded independently from public measurement records. */
export const ProtectedEvidenceRequest = Schema.Struct({
  blobId: Schema.NonEmptyString,
  ciphertext: Schema.NonEmptyString,
  consentRevision: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  deletionState: ProtectedEvidenceDeletionState,
  encryptionKeyVersion: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  installationId: Schema.NonEmptyString,
  purpose: ProtectedEvidencePurpose,
  retentionClass: ProtectedEvidenceRetentionClass,
  token: Schema.NonEmptyString,
});

export class ProtectedEvidenceAcceptedResponse extends Schema.Class<ProtectedEvidenceAcceptedResponse>(
  "ProtectedEvidenceAcceptedResponse",
)({
  accepted: Schema.Literal(true),
  blobId: Schema.NonEmptyString,
}) {}

export class ProtectedEvidenceConflictError extends Schema.TaggedErrorClass<ProtectedEvidenceConflictError>()(
  "ProtectedEvidenceConflictError",
  {
    ...CaptureErrorResponseFields,
    code: Schema.Literal("protected_evidence_conflict"),
  },
  { httpApiStatus: 409 },
) {}

/** Project-scoped deletion request containing opaque subject identifiers only. */
export const MeasurementDeletionRequest = Schema.Struct({
  installationId: Schema.NonEmptyString,
  personId: Schema.optional(Schema.NonEmptyString),
  requestId: Schema.NonEmptyString,
  requestedAt: DateValidFromString,
  token: Schema.NonEmptyString,
});

export class MeasurementDeletionAcceptedResponse extends Schema.Class<MeasurementDeletionAcceptedResponse>(
  "MeasurementDeletionAcceptedResponse",
)({
  accepted: Schema.Literal(true),
  deletedProtectedEvidence: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  requestId: Schema.NonEmptyString,
  status: Schema.Literal("completed"),
}) {}

export class CaptureUnauthorizedError extends Schema.TaggedErrorClass<CaptureUnauthorizedError>()(
  "CaptureUnauthorizedError",
  {
    ...CaptureErrorResponseFields,
    code: Schema.Literal("unauthorized"),
  },
  { httpApiStatus: 401 },
) {}

export const MeasurementConversionRule = Schema.Struct({
  coarseValue: Schema.optional(Schema.Literals(["low", "medium", "high"])),
  eventName: Schema.NonEmptyString,
  fineValue: Schema.Int.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.check(Schema.isLessThanOrEqualTo(63)),
  ),
  lockWindow: Schema.optional(Schema.Boolean),
  minimumCount: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  window: Schema.Int.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(1)),
    Schema.check(Schema.isLessThanOrEqualTo(3)),
  ),
});

export const MeasurementConfigurationPayload = Schema.Struct({
  collectors: Schema.Struct({
    appleAttributionEnabled: Schema.Boolean,
    linkAllowedDomains: Schema.Array(Schema.NonEmptyString),
  }),
  conversionRules: Schema.Array(MeasurementConversionRule),
  schemaVersion: Schema.Literal(1),
  storage: Schema.Struct({
    maxOutboxBytes: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
    maxOutboxRecords: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
    maxProtectedBytes: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  }),
});

export class SignedMeasurementConfigurationResponse extends Schema.Class<SignedMeasurementConfigurationResponse>(
  "SignedMeasurementConfigurationResponse",
)({
  expiresAt: DateValidFromString,
  keyId: Schema.NonEmptyString,
  payload: MeasurementConfigurationPayload,
  projectId: Schema.NonEmptyString,
  signature: Schema.NonEmptyString,
  version: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
}) {}

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
        payload: CaptureBatchRequest,
        success: CaptureAcceptedApiResponse,
      }),
    )
    .add(
      HttpApiEndpoint.post("protected", "/measurement/protected", {
        error: [
          CaptureInvalidRequestError,
          CaptureUnauthorizedError,
          CapturePayloadTooLargeError,
          ProtectedEvidenceConflictError,
          CaptureDependencyUnavailableError,
          CaptureInternalServerError,
        ],
        payload: ProtectedEvidenceRequest,
        success: ProtectedEvidenceAcceptedResponse.pipe(HttpApiSchema.status(202)),
      }),
    )
    .add(
      HttpApiEndpoint.post("deleteMeasurementData", "/measurement/delete", {
        error: [
          CaptureInvalidRequestError,
          CaptureUnauthorizedError,
          CaptureRateLimitedError,
          CaptureDependencyUnavailableError,
          CaptureInternalServerError,
        ],
        payload: MeasurementDeletionRequest,
        success: MeasurementDeletionAcceptedResponse.pipe(HttpApiSchema.status(202)),
      }),
    )
    .add(
      HttpApiEndpoint.get("getMeasurementConfiguration", "/measurement/config", {
        error: [
          CaptureUnauthorizedError,
          CaptureDependencyUnavailableError,
          CaptureInternalServerError,
        ],
        headers: Schema.Struct({ "x-publishable-key": Schema.NonEmptyString }),
        success: SignedMeasurementConfigurationResponse,
      }),
    )
    .prefix("/i/v1"),
);

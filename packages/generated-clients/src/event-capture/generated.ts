import type * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"

export interface EventCaptureCaptureRequest {
  readonly "uuid": string;
  readonly "event": string;
  readonly "context": Record<string, unknown>;
  readonly "properties": Record<string, unknown>;
  readonly "distinct_id": string;
  readonly "session_id"?: string | null | undefined;
  readonly "timestamp"?: string | null | undefined;
  readonly "sent_at": string;
  readonly "token": string
}

export type CaptureRejectedRecordReason = "malformed_envelope" | "unsupported_schema_version" | "payload_too_large" | "invalid_project_scope" | "duplicate" | "invalid_context" | "reserved_event" | "policy_rejected"

export interface CaptureRejectedRecord {
  readonly "recordId": string;
  readonly "reason": CaptureRejectedRecordReason
}

export interface CaptureAcceptedResponse {
  readonly "accepted": ReadonlyArray<string>;
  readonly "rejected": ReadonlyArray<CaptureRejectedRecord>
}

export type CaptureInvalidRequestErrorTag = "CaptureInvalidRequestError"

export type CaptureInvalidRequestErrorCode = "invalid_request"

export interface CaptureInvalidRequestError {
  readonly "_tag": CaptureInvalidRequestErrorTag;
  readonly "error": string;
  readonly "code": CaptureInvalidRequestErrorCode
}

export type CaptureUnauthorizedErrorTag = "CaptureUnauthorizedError"

export type CaptureUnauthorizedErrorCode = "unauthorized"

export interface CaptureUnauthorizedError {
  readonly "_tag": CaptureUnauthorizedErrorTag;
  readonly "error": string;
  readonly "code": CaptureUnauthorizedErrorCode
}

export type CapturePayloadTooLargeErrorTag = "CapturePayloadTooLargeError"

export type CapturePayloadTooLargeErrorCode = "payload_too_large"

export interface CapturePayloadTooLargeError {
  readonly "_tag": CapturePayloadTooLargeErrorTag;
  readonly "error": string;
  readonly "code": CapturePayloadTooLargeErrorCode
}

export type CaptureRateLimitedErrorTag = "CaptureRateLimitedError"

export type CaptureRateLimitedErrorCode = "rate_limited"

export interface CaptureRateLimitedError {
  readonly "_tag": CaptureRateLimitedErrorTag;
  readonly "error": string;
  readonly "code": CaptureRateLimitedErrorCode;
  readonly "retry_after_ms"?: number | null | undefined
}

export type CaptureInternalServerErrorTag = "CaptureInternalServerError"

export type CaptureInternalServerErrorCode = "internal_error"

export interface CaptureInternalServerError {
  readonly "_tag": CaptureInternalServerErrorTag;
  readonly "error": string;
  readonly "code": CaptureInternalServerErrorCode
}

export type CaptureDependencyUnavailableErrorTag = "CaptureDependencyUnavailableError"

export type CaptureDependencyUnavailableErrorCode = "dependency_unavailable"

export interface CaptureDependencyUnavailableError {
  readonly "_tag": CaptureDependencyUnavailableErrorTag;
  readonly "error": string;
  readonly "code": CaptureDependencyUnavailableErrorCode
}

export interface EventCaptureBatchRequest {
  readonly "events": ReadonlyArray<{
  readonly "uuid": string;
  readonly "event": string;
  readonly "context": Record<string, unknown>;
  readonly "properties": Record<string, unknown>;
  readonly "distinct_id": string;
  readonly "session_id"?: string | null | undefined;
  readonly "timestamp"?: string | null | undefined
}>;
  readonly "sent_at": string;
  readonly "token": string
}

export type EventCaptureProtectedRequestDeletionState = "active" | "deletion-requested" | "deleted"

export type EventCaptureProtectedRequestPurpose = "advertising-identifier" | "diagnostic-authorization" | "email" | "install-referrer" | "link-capture" | "partner-context" | "phone" | "purchase-receipt" | "push-token"

export type EventCaptureProtectedRequestRetentionClass = "ephemeral" | "installation" | "legal" | "transaction"

export interface EventCaptureProtectedRequest {
  readonly "blobId": string;
  readonly "ciphertext": string;
  readonly "consentRevision": number;
  readonly "deletionState": EventCaptureProtectedRequestDeletionState;
  readonly "encryptionKeyVersion": number;
  readonly "installationId": string;
  readonly "purpose": EventCaptureProtectedRequestPurpose;
  readonly "retentionClass": EventCaptureProtectedRequestRetentionClass;
  readonly "token": string
}

export type ProtectedEvidenceAcceptedResponseAccepted = true

export interface ProtectedEvidenceAcceptedResponse {
  readonly "accepted": ProtectedEvidenceAcceptedResponseAccepted;
  readonly "blobId": string
}

export type ProtectedEvidenceConflictErrorTag = "ProtectedEvidenceConflictError"

export type ProtectedEvidenceConflictErrorCode = "protected_evidence_conflict"

export interface ProtectedEvidenceConflictError {
  readonly "_tag": ProtectedEvidenceConflictErrorTag;
  readonly "error": string;
  readonly "code": ProtectedEvidenceConflictErrorCode
}

export interface EventCaptureDeleteMeasurementDataRequest {
  readonly "installationId": string;
  readonly "personId"?: string | null | undefined;
  readonly "requestId": string;
  readonly "requestedAt": string;
  readonly "token": string
}

export type MeasurementDeletionAcceptedResponseAccepted = true

export type MeasurementDeletionAcceptedResponseStatus = "completed"

export interface MeasurementDeletionAcceptedResponse {
  readonly "accepted": MeasurementDeletionAcceptedResponseAccepted;
  readonly "deletedProtectedEvidence": number;
  readonly "requestId": string;
  readonly "status": MeasurementDeletionAcceptedResponseStatus
}

export interface EventCaptureGetMeasurementConfigurationParams {
  readonly "x-publishable-key": string
}

export type SignedMeasurementConfigurationResponsePayloadSchemaVersion = 1

export interface SignedMeasurementConfigurationResponse {
  readonly "expiresAt": string;
  readonly "keyId": string;
  readonly "payload": {
  readonly "collectors": {
  readonly "appleAttributionEnabled": boolean;
  readonly "linkAllowedDomains": ReadonlyArray<string>
};
  readonly "conversionRules": ReadonlyArray<{
  readonly "coarseValue"?: "low" | "medium" | "high" | null | undefined;
  readonly "eventName": string;
  readonly "fineValue": number;
  readonly "lockWindow"?: boolean | null | undefined;
  readonly "minimumCount": number;
  readonly "window": number
}>;
  readonly "schemaVersion": SignedMeasurementConfigurationResponsePayloadSchemaVersion;
  readonly "storage": {
  readonly "maxOutboxBytes": number;
  readonly "maxOutboxRecords": number;
  readonly "maxProtectedBytes": number
}
};
  readonly "projectId": string;
  readonly "signature": string;
  readonly "version": number
}

export const make = (
  httpClient: HttpClient.HttpClient,
  options: {
    readonly transformClient?: ((client: HttpClient.HttpClient) => Effect.Effect<HttpClient.HttpClient>) | undefined
  } = {}
): VoidhashEventCaptureClient => {
  const unexpectedStatus = (response: HttpClientResponse.HttpClientResponse) =>
    Effect.flatMap(
      Effect.orElseSucceed(response.json, () => "Unexpected status code"),
      (description) =>
        Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.StatusCodeError({
              request: response.request,
              response,
              description:
                typeof description === "string"
                  ? description
                  : JSON.stringify(description),
            }),
          }),
        ),
    )
  const withResponse: <A, E>(
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, E>,
  ) => (
    request: HttpClientRequest.HttpClientRequest,
  ) => Effect.Effect<any, any> = options.transformClient
    ? (f) => (request) =>
        Effect.flatMap(
          Effect.flatMap(options.transformClient!(httpClient), (client) =>
            client.execute(request),
          ),
          f,
        )
    : (f) => (request) => Effect.flatMap(httpClient.execute(request), f)
  const decodeSuccess = <A>(response: HttpClientResponse.HttpClientResponse) =>
    response.json as Effect.Effect<A, HttpClientError.HttpClientError>
  const decodeVoid = (_response: HttpClientResponse.HttpClientResponse) =>
    Effect.void
  const decodeError =
    <Tag extends string, E>(tag: Tag) =>
    (
      response: HttpClientResponse.HttpClientResponse,
    ): Effect.Effect<
      never,
      VoidhashEventCaptureClientError<Tag, E> | HttpClientError.HttpClientError
    > =>
      Effect.flatMap(
        response.json as Effect.Effect<E, HttpClientError.HttpClientError>,
        (cause) => Effect.fail(VoidhashEventCaptureClientError(tag, cause, response)),
      )
  const onRequest = (
    successCodes: ReadonlyArray<string>,
    errorCodes?: Record<string, string>,
  ) => {
    const cases: any = { orElse: unexpectedStatus }
    for (const code of successCodes) {
      cases[code] = decodeSuccess
    }
    if (errorCodes) {
      for (const [code, tag] of Object.entries(errorCodes)) {
        cases[code] = decodeError(tag)
      }
    }
    if (successCodes.length === 0) {
      cases["2xx"] = decodeVoid
    }
    return withResponse(HttpClientResponse.matchStatus(cases) as any)
  }
  return {
    httpClient,
    "eventCaptureCapture": (options) => HttpClientRequest.post(`/i/v1/capture`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"CaptureInvalidRequestError","401":"CaptureUnauthorizedError","413":"CapturePayloadTooLargeError","429":"CaptureRateLimitedError","500":"CaptureInternalServerError","503":"CaptureDependencyUnavailableError"})
  ),
  "eventCaptureBatch": (options) => HttpClientRequest.post(`/i/v1/batch`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"CaptureInvalidRequestError","401":"CaptureUnauthorizedError","413":"CapturePayloadTooLargeError","429":"CaptureRateLimitedError","500":"CaptureInternalServerError","503":"CaptureDependencyUnavailableError"})
  ),
  "eventCaptureProtected": (options) => HttpClientRequest.post(`/i/v1/measurement/protected`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"CaptureInvalidRequestError","401":"CaptureUnauthorizedError","409":"ProtectedEvidenceConflictError","413":"CapturePayloadTooLargeError","500":"CaptureInternalServerError","503":"CaptureDependencyUnavailableError"})
  ),
  "eventCaptureDeleteMeasurementData": (options) => HttpClientRequest.post(`/i/v1/measurement/delete`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"CaptureInvalidRequestError","401":"CaptureUnauthorizedError","429":"CaptureRateLimitedError","500":"CaptureInternalServerError","503":"CaptureDependencyUnavailableError"})
  ),
  "eventCaptureGetMeasurementConfiguration": (options) => HttpClientRequest.get(`/i/v1/measurement/config`).pipe(
    HttpClientRequest.setHeaders({ "x-publishable-key": options?.["x-publishable-key"] ?? undefined }),
    onRequest(["2xx"], {"401":"CaptureUnauthorizedError","500":"CaptureInternalServerError","503":"CaptureDependencyUnavailableError"})
  )
  }
}

export interface VoidhashEventCaptureClient {
  readonly httpClient: HttpClient.HttpClient
  readonly "eventCaptureCapture": (options: EventCaptureCaptureRequest) => Effect.Effect<CaptureAcceptedResponse, HttpClientError.HttpClientError | VoidhashEventCaptureClientError<"CaptureInvalidRequestError", CaptureInvalidRequestError> | VoidhashEventCaptureClientError<"CaptureUnauthorizedError", CaptureUnauthorizedError> | VoidhashEventCaptureClientError<"CapturePayloadTooLargeError", CapturePayloadTooLargeError> | VoidhashEventCaptureClientError<"CaptureRateLimitedError", CaptureRateLimitedError> | VoidhashEventCaptureClientError<"CaptureInternalServerError", CaptureInternalServerError> | VoidhashEventCaptureClientError<"CaptureDependencyUnavailableError", CaptureDependencyUnavailableError>>
  readonly "eventCaptureBatch": (options: EventCaptureBatchRequest) => Effect.Effect<CaptureAcceptedResponse, HttpClientError.HttpClientError | VoidhashEventCaptureClientError<"CaptureInvalidRequestError", CaptureInvalidRequestError> | VoidhashEventCaptureClientError<"CaptureUnauthorizedError", CaptureUnauthorizedError> | VoidhashEventCaptureClientError<"CapturePayloadTooLargeError", CapturePayloadTooLargeError> | VoidhashEventCaptureClientError<"CaptureRateLimitedError", CaptureRateLimitedError> | VoidhashEventCaptureClientError<"CaptureInternalServerError", CaptureInternalServerError> | VoidhashEventCaptureClientError<"CaptureDependencyUnavailableError", CaptureDependencyUnavailableError>>
  readonly "eventCaptureProtected": (options: EventCaptureProtectedRequest) => Effect.Effect<ProtectedEvidenceAcceptedResponse, HttpClientError.HttpClientError | VoidhashEventCaptureClientError<"CaptureInvalidRequestError", CaptureInvalidRequestError> | VoidhashEventCaptureClientError<"CaptureUnauthorizedError", CaptureUnauthorizedError> | VoidhashEventCaptureClientError<"ProtectedEvidenceConflictError", ProtectedEvidenceConflictError> | VoidhashEventCaptureClientError<"CapturePayloadTooLargeError", CapturePayloadTooLargeError> | VoidhashEventCaptureClientError<"CaptureInternalServerError", CaptureInternalServerError> | VoidhashEventCaptureClientError<"CaptureDependencyUnavailableError", CaptureDependencyUnavailableError>>
  readonly "eventCaptureDeleteMeasurementData": (options: EventCaptureDeleteMeasurementDataRequest) => Effect.Effect<MeasurementDeletionAcceptedResponse, HttpClientError.HttpClientError | VoidhashEventCaptureClientError<"CaptureInvalidRequestError", CaptureInvalidRequestError> | VoidhashEventCaptureClientError<"CaptureUnauthorizedError", CaptureUnauthorizedError> | VoidhashEventCaptureClientError<"CaptureRateLimitedError", CaptureRateLimitedError> | VoidhashEventCaptureClientError<"CaptureInternalServerError", CaptureInternalServerError> | VoidhashEventCaptureClientError<"CaptureDependencyUnavailableError", CaptureDependencyUnavailableError>>
  readonly "eventCaptureGetMeasurementConfiguration": (options: EventCaptureGetMeasurementConfigurationParams) => Effect.Effect<SignedMeasurementConfigurationResponse, HttpClientError.HttpClientError | VoidhashEventCaptureClientError<"CaptureUnauthorizedError", CaptureUnauthorizedError> | VoidhashEventCaptureClientError<"CaptureInternalServerError", CaptureInternalServerError> | VoidhashEventCaptureClientError<"CaptureDependencyUnavailableError", CaptureDependencyUnavailableError>>
}

export interface VoidhashEventCaptureClientError<Tag extends string, E> extends Error {
  readonly _tag: Tag
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response: HttpClientResponse.HttpClientResponse
  readonly data: E
  readonly message: string
}

class VoidhashEventCaptureClientErrorImpl extends Data.Error<{
  _tag: string
  data: any
  message: string
  request: HttpClientRequest.HttpClientRequest
  response: HttpClientResponse.HttpClientResponse
}> {
  name = "VoidhashEventCaptureClientError"
}

export const VoidhashEventCaptureClientError = <Tag extends string, E>(
  tag: Tag,
  data: E,
  response: HttpClientResponse.HttpClientResponse,
): VoidhashEventCaptureClientError<Tag, E> =>
  new VoidhashEventCaptureClientErrorImpl({
    _tag: tag,
    data,
    message: JSON.stringify(data),
    response,
    request: response.request,
  }) as any

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

export interface CaptureAcceptedResponse {
  readonly "accepted": number;
  readonly "rejected": number
}

export type CaptureInvalidRequestErrorTag = "CaptureInvalidRequestError"

export type CaptureInvalidRequestErrorCode = "invalid_request"

export interface CaptureInvalidRequestError {
  readonly "_tag": CaptureInvalidRequestErrorTag;
  readonly "error": string;
  readonly "code": CaptureInvalidRequestErrorCode
}

export type EffectHttpApiSchemaErrorTag = "HttpApiSchemaError"

export interface EffectHttpApiSchemaError {
  readonly "_tag": EffectHttpApiSchemaErrorTag;
  readonly "message": string
}

export type EventCaptureCapture400 = CaptureInvalidRequestError | EffectHttpApiSchemaError

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

export type EventCaptureBatch400 = CaptureInvalidRequestError | EffectHttpApiSchemaError

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
    "eventCaptureCapture": (options) => HttpClientRequest.post(`/capture`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"EventCaptureCapture400","401":"CaptureUnauthorizedError","413":"CapturePayloadTooLargeError","429":"CaptureRateLimitedError","500":"CaptureInternalServerError","503":"CaptureDependencyUnavailableError"})
  ),
  "eventCaptureBatch": (options) => HttpClientRequest.post(`/batch`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"EventCaptureBatch400","401":"CaptureUnauthorizedError","413":"CapturePayloadTooLargeError","429":"CaptureRateLimitedError","500":"CaptureInternalServerError","503":"CaptureDependencyUnavailableError"})
  )
  }
}

export interface VoidhashEventCaptureClient {
  readonly httpClient: HttpClient.HttpClient
  readonly "eventCaptureCapture": (options: EventCaptureCaptureRequest) => Effect.Effect<CaptureAcceptedResponse, HttpClientError.HttpClientError | VoidhashEventCaptureClientError<"EventCaptureCapture400", EventCaptureCapture400> | VoidhashEventCaptureClientError<"CaptureUnauthorizedError", CaptureUnauthorizedError> | VoidhashEventCaptureClientError<"CapturePayloadTooLargeError", CapturePayloadTooLargeError> | VoidhashEventCaptureClientError<"CaptureRateLimitedError", CaptureRateLimitedError> | VoidhashEventCaptureClientError<"CaptureInternalServerError", CaptureInternalServerError> | VoidhashEventCaptureClientError<"CaptureDependencyUnavailableError", CaptureDependencyUnavailableError>>
  readonly "eventCaptureBatch": (options: EventCaptureBatchRequest) => Effect.Effect<CaptureAcceptedResponse, HttpClientError.HttpClientError | VoidhashEventCaptureClientError<"EventCaptureBatch400", EventCaptureBatch400> | VoidhashEventCaptureClientError<"CaptureUnauthorizedError", CaptureUnauthorizedError> | VoidhashEventCaptureClientError<"CapturePayloadTooLargeError", CapturePayloadTooLargeError> | VoidhashEventCaptureClientError<"CaptureRateLimitedError", CaptureRateLimitedError> | VoidhashEventCaptureClientError<"CaptureInternalServerError", CaptureInternalServerError> | VoidhashEventCaptureClientError<"CaptureDependencyUnavailableError", CaptureDependencyUnavailableError>>
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

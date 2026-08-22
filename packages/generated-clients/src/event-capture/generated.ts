import type * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"

export interface EventCaptureCaptureParams {
  readonly "x-secret-key"?: string | null | undefined
}

export type Objects = Record<string, unknown>

export type Objects1 = Record<string, unknown>

export interface EventCaptureCaptureRequest {
  readonly "uuid": string;
  readonly "event": string;
  readonly "context": Objects;
  readonly "properties": Objects1;
  readonly "distinct_id": string;
  readonly "session_id"?: string | null | undefined;
  readonly "timestamp"?: string | null | undefined;
  readonly "sent_at": string;
  readonly "token"?: string | null | undefined
}

export interface CaptureAcceptedResponseJsonEncoding {
  readonly "accepted": number;
  readonly "rejected": number
}

export type CaptureInvalidRequestErrorJsonEncodingTag = "CaptureInvalidRequestError"

export type CaptureInvalidRequestErrorJsonEncodingCode = "invalid_request"

export interface CaptureInvalidRequestErrorJsonEncoding {
  readonly "_tag": CaptureInvalidRequestErrorJsonEncodingTag;
  readonly "error": string;
  readonly "code": CaptureInvalidRequestErrorJsonEncodingCode
}

export type CaptureUnauthorizedErrorJsonEncodingTag = "CaptureUnauthorizedError"

export type CaptureUnauthorizedErrorJsonEncodingCode = "unauthorized"

export interface CaptureUnauthorizedErrorJsonEncoding {
  readonly "_tag": CaptureUnauthorizedErrorJsonEncodingTag;
  readonly "error": string;
  readonly "code": CaptureUnauthorizedErrorJsonEncodingCode
}

export type CapturePayloadTooLargeErrorJsonEncodingTag = "CapturePayloadTooLargeError"

export type CapturePayloadTooLargeErrorJsonEncodingCode = "payload_too_large"

export interface CapturePayloadTooLargeErrorJsonEncoding {
  readonly "_tag": CapturePayloadTooLargeErrorJsonEncodingTag;
  readonly "error": string;
  readonly "code": CapturePayloadTooLargeErrorJsonEncodingCode
}

export type CaptureRateLimitedErrorJsonEncodingTag = "CaptureRateLimitedError"

export type CaptureRateLimitedErrorJsonEncodingCode = "rate_limited"

export interface CaptureRateLimitedErrorJsonEncoding {
  readonly "_tag": CaptureRateLimitedErrorJsonEncodingTag;
  readonly "error": string;
  readonly "code": CaptureRateLimitedErrorJsonEncodingCode;
  readonly "retry_after_ms"?: number | null | undefined
}

export type CaptureInternalServerErrorJsonEncodingTag = "CaptureInternalServerError"

export type CaptureInternalServerErrorJsonEncodingCode = "internal_error"

export interface CaptureInternalServerErrorJsonEncoding {
  readonly "_tag": CaptureInternalServerErrorJsonEncodingTag;
  readonly "error": string;
  readonly "code": CaptureInternalServerErrorJsonEncodingCode
}

export type CaptureDependencyUnavailableErrorJsonEncodingTag = "CaptureDependencyUnavailableError"

export type CaptureDependencyUnavailableErrorJsonEncodingCode = "dependency_unavailable"

export interface CaptureDependencyUnavailableErrorJsonEncoding {
  readonly "_tag": CaptureDependencyUnavailableErrorJsonEncodingTag;
  readonly "error": string;
  readonly "code": CaptureDependencyUnavailableErrorJsonEncodingCode
}

export interface EventCaptureBatchParams {
  readonly "x-secret-key"?: string | null | undefined
}

export interface Objects2 {
  readonly "uuid": string;
  readonly "event": string;
  readonly "context": Objects;
  readonly "properties": Objects1;
  readonly "distinct_id": string;
  readonly "session_id"?: string | null | undefined;
  readonly "timestamp"?: string | null | undefined
}

export interface EventCaptureBatchRequest {
  readonly "events": ReadonlyArray<Objects2>;
  readonly "sent_at": string;
  readonly "token"?: string | null | undefined
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
    HttpClientRequest.setHeaders({ "x-secret-key": options.params?.["x-secret-key"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"400":"CaptureInvalidRequestErrorJsonEncoding","401":"CaptureUnauthorizedErrorJsonEncoding","413":"CapturePayloadTooLargeErrorJsonEncoding","429":"CaptureRateLimitedErrorJsonEncoding","500":"CaptureInternalServerErrorJsonEncoding","503":"CaptureDependencyUnavailableErrorJsonEncoding"})
  ),
  "eventCaptureBatch": (options) => HttpClientRequest.post(`/i/v1/batch`).pipe(
    HttpClientRequest.setHeaders({ "x-secret-key": options.params?.["x-secret-key"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"400":"CaptureInvalidRequestErrorJsonEncoding","401":"CaptureUnauthorizedErrorJsonEncoding","413":"CapturePayloadTooLargeErrorJsonEncoding","429":"CaptureRateLimitedErrorJsonEncoding","500":"CaptureInternalServerErrorJsonEncoding","503":"CaptureDependencyUnavailableErrorJsonEncoding"})
  )
  }
}

export interface VoidhashEventCaptureClient {
  readonly httpClient: HttpClient.HttpClient
  readonly "eventCaptureCapture": (options: { readonly params?: EventCaptureCaptureParams | undefined; readonly payload: EventCaptureCaptureRequest }) => Effect.Effect<CaptureAcceptedResponseJsonEncoding, HttpClientError.HttpClientError | VoidhashEventCaptureClientError<"CaptureInvalidRequestErrorJsonEncoding", CaptureInvalidRequestErrorJsonEncoding> | VoidhashEventCaptureClientError<"CaptureUnauthorizedErrorJsonEncoding", CaptureUnauthorizedErrorJsonEncoding> | VoidhashEventCaptureClientError<"CapturePayloadTooLargeErrorJsonEncoding", CapturePayloadTooLargeErrorJsonEncoding> | VoidhashEventCaptureClientError<"CaptureRateLimitedErrorJsonEncoding", CaptureRateLimitedErrorJsonEncoding> | VoidhashEventCaptureClientError<"CaptureInternalServerErrorJsonEncoding", CaptureInternalServerErrorJsonEncoding> | VoidhashEventCaptureClientError<"CaptureDependencyUnavailableErrorJsonEncoding", CaptureDependencyUnavailableErrorJsonEncoding>>
  readonly "eventCaptureBatch": (options: { readonly params?: EventCaptureBatchParams | undefined; readonly payload: EventCaptureBatchRequest }) => Effect.Effect<CaptureAcceptedResponseJsonEncoding, HttpClientError.HttpClientError | VoidhashEventCaptureClientError<"CaptureInvalidRequestErrorJsonEncoding", CaptureInvalidRequestErrorJsonEncoding> | VoidhashEventCaptureClientError<"CaptureUnauthorizedErrorJsonEncoding", CaptureUnauthorizedErrorJsonEncoding> | VoidhashEventCaptureClientError<"CapturePayloadTooLargeErrorJsonEncoding", CapturePayloadTooLargeErrorJsonEncoding> | VoidhashEventCaptureClientError<"CaptureRateLimitedErrorJsonEncoding", CaptureRateLimitedErrorJsonEncoding> | VoidhashEventCaptureClientError<"CaptureInternalServerErrorJsonEncoding", CaptureInternalServerErrorJsonEncoding> | VoidhashEventCaptureClientError<"CaptureDependencyUnavailableErrorJsonEncoding", CaptureDependencyUnavailableErrorJsonEncoding>>
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

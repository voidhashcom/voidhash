import type * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"

export type LinksCreateLinkRequestBrandedDomainEnum = string

export type LinksCreateLinkRequestCampaignEnumAdEnum = string

export type LinksCreateLinkRequestCampaignEnumAdSetEnum = string

export type LinksCreateLinkRequestCampaignEnumCampaignEnum = string

export type LinksCreateLinkRequestCampaignEnumChannelEnum = string

export type LinksCreateLinkRequestCampaignEnumMediaSourceEnum = string

export type LinksCreateLinkRequestDestinationAndroidStoreUrlEnum = string

export type LinksCreateLinkRequestDestinationAppleAppIdEnum = string

export type LinksCreateLinkRequestDestinationBaseDeepLinkEnum = string

export type LinksCreateLinkRequestDestinationDeepLinkValue = string

export type LinksCreateLinkRequestDestinationIosStoreUrlEnum = string

export type LinksCreateLinkRequestDestinationWebFallbackUrlEnum = string

export type LinksCreateLinkRequestIdempotencyKeyEnum = string

export type LinksCreateLinkRequestReferrerCustomerIdEnum = string

export type LinksCreateLinkRequestReferrerImageUrlEnum = string

export type LinksCreateLinkRequestReferrerNameEnum = string

export type LinksCreateLinkRequestReferrerUidEnum = string

export type LinksCreateLinkRequestTemplateIdEnum = string

export type LinksCreateLinkRequestToken = string

export interface LinksCreateLinkRequest {
  readonly "brandedDomain"?: string | null | undefined;
  readonly "campaign"?: {
  readonly "ad"?: string | null | undefined;
  readonly "adSet"?: string | null | undefined;
  readonly "campaign"?: string | null | undefined;
  readonly "channel"?: string | null | undefined;
  readonly "mediaSource"?: string | null | undefined
} | null | undefined;
  readonly "customParameters"?: Record<string, unknown> | null | undefined;
  readonly "destination": {
  readonly "androidStoreUrl"?: string | null | undefined;
  readonly "appleAppId"?: string | null | undefined;
  readonly "baseDeepLink"?: string | null | undefined;
  readonly "deepLinkValue": LinksCreateLinkRequestDestinationDeepLinkValue;
  readonly "iosStoreUrl"?: string | null | undefined;
  readonly "subvalues"?: Record<string, unknown> | null | undefined;
  readonly "webFallbackUrl"?: string | null | undefined
};
  readonly "expiresAt"?: string | null | undefined;
  readonly "idempotencyKey"?: string | null | undefined;
  readonly "referrerCustomerId"?: string | null | undefined;
  readonly "referrerImageUrl"?: string | null | undefined;
  readonly "referrerName"?: string | null | undefined;
  readonly "referrerUid"?: string | null | undefined;
  readonly "templateId"?: string | null | undefined;
  readonly "token": LinksCreateLinkRequestToken
}

export type CreateLinkResponseLinkId = string

export type CreateLinkResponseUrl = string

export interface CreateLinkResponse {
  readonly "expiresAt": string;
  readonly "linkId": CreateLinkResponseLinkId;
  readonly "url": CreateLinkResponseUrl
}

export type LinkInvalidRequestErrorTag = "LinkInvalidRequestError"

export type LinkInvalidRequestErrorCode = "invalid_link_request"

export interface LinkInvalidRequestError {
  readonly "_tag": LinkInvalidRequestErrorTag;
  readonly "code": LinkInvalidRequestErrorCode;
  readonly "error": string
}

export type LinkUnauthorizedErrorTag = "LinkUnauthorizedError"

export type LinkUnauthorizedErrorCode = "unauthorized"

export interface LinkUnauthorizedError {
  readonly "_tag": LinkUnauthorizedErrorTag;
  readonly "code": LinkUnauthorizedErrorCode;
  readonly "error": string
}

export type LinkRateLimitedErrorTag = "LinkRateLimitedError"

export type LinkRateLimitedErrorCode = "rate_limited"

export interface LinkRateLimitedError {
  readonly "_tag": LinkRateLimitedErrorTag;
  readonly "code": LinkRateLimitedErrorCode;
  readonly "error": string
}

export type LinkServiceUnavailableErrorTag = "LinkServiceUnavailableError"

export type LinkServiceUnavailableErrorCode = "service_unavailable"

export interface LinkServiceUnavailableError {
  readonly "_tag": LinkServiceUnavailableErrorTag;
  readonly "code": LinkServiceUnavailableErrorCode;
  readonly "error": string
}

export type LinksResolveDeferredLinkRequestDeferredToken = string

export type LinksResolveDeferredLinkRequestInstallationId = string

export type LinksResolveDeferredLinkRequestPlatform = "ios" | "android"

export type LinksResolveDeferredLinkRequestToken = string

export interface LinksResolveDeferredLinkRequest {
  readonly "deferredToken": LinksResolveDeferredLinkRequestDeferredToken;
  readonly "installationId": LinksResolveDeferredLinkRequestInstallationId;
  readonly "platform": LinksResolveDeferredLinkRequestPlatform;
  readonly "token": LinksResolveDeferredLinkRequestToken
}

export type LinksResolveDeferredLink200CampaignEnumAdEnum = string

export type LinksResolveDeferredLink200CampaignEnumAdSetEnum = string

export type LinksResolveDeferredLink200CampaignEnumCampaignEnum = string

export type LinksResolveDeferredLink200CampaignEnumChannelEnum = string

export type LinksResolveDeferredLink200CampaignEnumMediaSourceEnum = string

export type LinksResolveDeferredLink200ClickIdEnum = string

export type LinksResolveDeferredLink200DeferredEnum = true

export type LinksResolveDeferredLink200LinkIdEnum = string

export type LinksResolveDeferredLink200ReasonEnum = "expired" | "not-found" | "replayed" | "invalid"

export type LinksResolveDeferredLink200RouteEnumValue = string

export type LinksResolveDeferredLink200SignatureEnum = string

export type LinksResolveDeferredLink200Status = "found" | "notFound"

export interface LinksResolveDeferredLink200 {
  readonly "campaign"?: {
  readonly "ad"?: string | null | undefined;
  readonly "adSet"?: string | null | undefined;
  readonly "campaign"?: string | null | undefined;
  readonly "channel"?: string | null | undefined;
  readonly "mediaSource"?: string | null | undefined
} | null | undefined;
  readonly "clickId"?: string | null | undefined;
  readonly "clickedAt"?: string | null | undefined;
  readonly "deferred"?: LinksResolveDeferredLink200DeferredEnum | null | undefined;
  readonly "expiresAt"?: string | null | undefined;
  readonly "linkId"?: string | null | undefined;
  readonly "reason"?: LinksResolveDeferredLink200ReasonEnum | null | undefined;
  readonly "route"?: {
  readonly "subvalues": Record<string, unknown>;
  readonly "value": string
} | null | undefined;
  readonly "signature"?: string | null | undefined;
  readonly "status": LinksResolveDeferredLink200Status
}

export const make = (
  httpClient: HttpClient.HttpClient,
  options: {
    readonly transformClient?: ((client: HttpClient.HttpClient) => Effect.Effect<HttpClient.HttpClient>) | undefined
  } = {}
): VoidhashLinksClient => {
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
      VoidhashLinksClientError<Tag, E> | HttpClientError.HttpClientError
    > =>
      Effect.flatMap(
        response.json as Effect.Effect<E, HttpClientError.HttpClientError>,
        (cause) => Effect.fail(VoidhashLinksClientError(tag, cause, response)),
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
    "linksCreateLink": (options) => HttpClientRequest.post(`/l/v1/links`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"LinkInvalidRequestError","401":"LinkUnauthorizedError","429":"LinkRateLimitedError","503":"LinkServiceUnavailableError"})
  ),
  "linksResolveDeferredLink": (options) => HttpClientRequest.post(`/l/v1/deferred/resolve`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"LinkInvalidRequestError","401":"LinkUnauthorizedError","429":"LinkRateLimitedError","503":"LinkServiceUnavailableError"})
  )
  }
}

export interface VoidhashLinksClient {
  readonly httpClient: HttpClient.HttpClient
  readonly "linksCreateLink": (options: LinksCreateLinkRequest) => Effect.Effect<CreateLinkResponse, HttpClientError.HttpClientError | VoidhashLinksClientError<"LinkInvalidRequestError", LinkInvalidRequestError> | VoidhashLinksClientError<"LinkUnauthorizedError", LinkUnauthorizedError> | VoidhashLinksClientError<"LinkRateLimitedError", LinkRateLimitedError> | VoidhashLinksClientError<"LinkServiceUnavailableError", LinkServiceUnavailableError>>
  readonly "linksResolveDeferredLink": (options: LinksResolveDeferredLinkRequest) => Effect.Effect<LinksResolveDeferredLink200, HttpClientError.HttpClientError | VoidhashLinksClientError<"LinkInvalidRequestError", LinkInvalidRequestError> | VoidhashLinksClientError<"LinkUnauthorizedError", LinkUnauthorizedError> | VoidhashLinksClientError<"LinkRateLimitedError", LinkRateLimitedError> | VoidhashLinksClientError<"LinkServiceUnavailableError", LinkServiceUnavailableError>>
}

export interface VoidhashLinksClientError<Tag extends string, E> extends Error {
  readonly _tag: Tag
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response: HttpClientResponse.HttpClientResponse
  readonly data: E
  readonly message: string
}

class VoidhashLinksClientErrorImpl extends Data.Error<{
  _tag: string
  data: any
  message: string
  request: HttpClientRequest.HttpClientRequest
  response: HttpClientResponse.HttpClientResponse
}> {
  name = "VoidhashLinksClientError"
}

export const VoidhashLinksClientError = <Tag extends string, E>(
  tag: Tag,
  data: E,
  response: HttpClientResponse.HttpClientResponse,
): VoidhashLinksClientError<Tag, E> =>
  new VoidhashLinksClientErrorImpl({
    _tag: tag,
    data,
    message: JSON.stringify(data),
    response,
    request: response.request,
  }) as any

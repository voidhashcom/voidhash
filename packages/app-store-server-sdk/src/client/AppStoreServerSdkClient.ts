import { Effect, Option, Schema } from "effect";
import { HttpBody, HttpClient, HttpClientRequest } from "effect/unstable/http";
import type { HttpClientError } from "effect/unstable/http";
import { createAppStoreApiError, type AppStoreApiError } from "../errors/api-errors.ts";
import {
  AppStoreJwtError,
  AppStoreNetworkError,
  AppStoreParseError,
  AppStoreSchemaError,
  type AppStoreClientError,
} from "../errors/client-errors.ts";
import { AppStoreServerSdk } from "../sdk.ts";
import { Environment, GetTransactionHistoryVersion } from "../schemas/enums.ts";
import { createBearerToken, type BearerTokenConfig } from "./auth.ts";
import {
  type ConsumptionRequest,
  ConsumptionRequestSchema,
  type ConsumptionRequestV1,
  ConsumptionRequestV1Schema,
  type DefaultConfigurationRequest,
  DefaultConfigurationRequestSchema,
  type ExtendRenewalDateRequest,
  ExtendRenewalDateRequestSchema,
  type MassExtendRenewalDateRequest,
  MassExtendRenewalDateRequestSchema,
  type NotificationHistoryRequest,
  NotificationHistoryRequestSchema,
  type PerformanceTestRequest,
  PerformanceTestRequestSchema,
  type TransactionHistoryRequest,
  type UpdateAppAccountTokenRequest,
  UpdateAppAccountTokenRequestSchema,
  type UploadMessageRequestBody,
  UploadMessageRequestBodySchema,
} from "../schemas/requests.ts";
import { RealtimeUrlRequestSchema, type RealtimeUrlRequest } from "../schemas/realtime.ts";
import {
  type AppTransactionInfoResponse,
  AppTransactionInfoResponseSchema,
  type CheckTestNotificationResponse,
  CheckTestNotificationResponseSchema,
  type DefaultConfigurationResponse,
  DefaultConfigurationResponseSchema,
  type ExtendRenewalDateResponse,
  ExtendRenewalDateResponseSchema,
  type GetImageListResponse,
  GetImageListResponseSchema,
  type GetMessageListResponse,
  GetMessageListResponseSchema,
  type HistoryResponse,
  HistoryResponseSchema,
  type MassExtendRenewalDateResponse,
  MassExtendRenewalDateResponseSchema,
  type MassExtendRenewalDateStatusResponse,
  MassExtendRenewalDateStatusResponseSchema,
  type NotificationHistoryResponse,
  NotificationHistoryResponseSchema,
  type OrderLookupResponse,
  OrderLookupResponseSchema,
  type PerformanceTestResponse,
  PerformanceTestResponseSchema,
  type PerformanceTestResultResponse,
  PerformanceTestResultResponseSchema,
  type RealtimeUrlResponse,
  RealtimeUrlResponseSchema,
  type RefundHistoryResponse,
  RefundHistoryResponseSchema,
  type SendTestNotificationResponse,
  SendTestNotificationResponseSchema,
  type StatusResponse,
  StatusResponseSchema,
  type TransactionInfoResponse,
  TransactionInfoResponseSchema,
} from "../schemas/responses.ts";
import { type Status } from "../schemas/enums.ts";

/**
 * Configuration for a per-tenant {@link AppStoreServerSdkClient}. Combines the
 * App Store Connect credentials needed to mint bearer tokens with the target
 * environment.
 */
export interface AppStoreServerSdkClientConfig extends BearerTokenConfig {
  readonly environment: (typeof Environment)[keyof typeof Environment];
}

const PRODUCTION_URL = "https://api.storekit.itunes.apple.com";
const SANDBOX_URL = "https://api.storekit-sandbox.itunes.apple.com";
const LOCAL_TESTING_URL = "https://local-testing-base-url";
const USER_AGENT = "app-store-server-sdk-effect/1.0.0";

type DecodableSchema<T> = Schema.Top & {
  readonly Type: T;
  readonly DecodingServices: never;
};

type EncodableSchema<T> = DecodableSchema<T> & {
  readonly Encoded: unknown;
  readonly EncodingServices: never;
};

/**
 * Combined error type for all App Store client operations. Note: the HTTP
 * client dependency is absorbed by the parent {@link AppStoreServerSdk}, so
 * client methods return `Effect<T, AppStoreError>` rather than
 * `Effect<T, AppStoreError, HttpClient>`.
 */
export type AppStoreError = AppStoreClientError | AppStoreApiError;

export type {
  ConsumptionRequest,
  ConsumptionRequestV1,
  DefaultConfigurationRequest,
  ExtendRenewalDateRequest,
  MassExtendRenewalDateRequest,
  NotificationHistoryRequest,
  PerformanceTestRequest,
  RealtimeUrlRequest,
  TransactionHistoryRequest,
  UpdateAppAccountTokenRequest,
  UploadMessageRequestBody,
};

/**
 * Per-tenant App Store Server API client. Construct via
 * {@link AppStoreServerSdkClient.make}.
 */
export interface AppStoreServerSdkClient {
  // Transaction endpoints
  readonly getTransactionInfo: (
    transactionId: string,
  ) => Effect.Effect<TransactionInfoResponse, AppStoreError>;

  readonly getTransactionHistory: (
    transactionId: string,
    revision: Option.Option<string>,
    request: TransactionHistoryRequest,
    version: Option.Option<
      (typeof GetTransactionHistoryVersion)[keyof typeof GetTransactionHistoryVersion]
    >,
  ) => Effect.Effect<HistoryResponse, AppStoreError>;

  readonly getRefundHistory: (
    transactionId: string,
    revision: Option.Option<string>,
  ) => Effect.Effect<RefundHistoryResponse, AppStoreError>;

  readonly lookUpOrderId: (orderId: string) => Effect.Effect<OrderLookupResponse, AppStoreError>;

  readonly setAppAccountToken: (
    originalTransactionId: string,
    request: UpdateAppAccountTokenRequest,
  ) => Effect.Effect<void, AppStoreError>;

  readonly getAppTransactionInfo: (
    transactionId: string,
  ) => Effect.Effect<AppTransactionInfoResponse, AppStoreError>;

  // Subscription endpoints
  readonly getAllSubscriptionStatuses: (
    transactionId: string,
    status: Option.Option<Status[]>,
  ) => Effect.Effect<StatusResponse, AppStoreError>;

  readonly extendSubscriptionRenewalDate: (
    originalTransactionId: string,
    request: ExtendRenewalDateRequest,
  ) => Effect.Effect<ExtendRenewalDateResponse, AppStoreError>;

  readonly extendRenewalDateForAllActiveSubscribers: (
    request: MassExtendRenewalDateRequest,
  ) => Effect.Effect<MassExtendRenewalDateResponse, AppStoreError>;

  readonly getStatusOfSubscriptionRenewalDateExtensions: (
    requestIdentifier: string,
    productId: string,
  ) => Effect.Effect<MassExtendRenewalDateStatusResponse, AppStoreError>;

  // Consumption endpoints
  readonly sendConsumptionInformation: (
    transactionId: string,
    request: ConsumptionRequest,
  ) => Effect.Effect<void, AppStoreError>;

  /** @deprecated Use {@link sendConsumptionInformation}. */
  readonly sendConsumptionData: (
    transactionId: string,
    request: ConsumptionRequestV1,
  ) => Effect.Effect<void, AppStoreError>;

  /** Marks a transaction as finished. */
  readonly finishTransaction: (transactionId: string) => Effect.Effect<void, AppStoreError>;

  // Notification endpoints
  readonly requestTestNotification: () => Effect.Effect<
    SendTestNotificationResponse,
    AppStoreError
  >;

  readonly getTestNotificationStatus: (
    testNotificationToken: string,
  ) => Effect.Effect<CheckTestNotificationResponse, AppStoreError>;

  readonly getNotificationHistory: (
    paginationToken: Option.Option<string>,
    request: NotificationHistoryRequest,
  ) => Effect.Effect<NotificationHistoryResponse, AppStoreError>;

  // Messaging endpoints
  readonly uploadImage: (
    imageIdentifier: string,
    image: Uint8Array,
    imageSize: Option.Option<string>,
  ) => Effect.Effect<void, AppStoreError>;

  readonly deleteImage: (imageIdentifier: string) => Effect.Effect<void, AppStoreError>;

  readonly getImageList: () => Effect.Effect<GetImageListResponse, AppStoreError>;

  readonly uploadMessage: (
    messageIdentifier: string,
    request: UploadMessageRequestBody,
  ) => Effect.Effect<void, AppStoreError>;

  readonly deleteMessage: (messageIdentifier: string) => Effect.Effect<void, AppStoreError>;

  readonly getMessageList: () => Effect.Effect<GetMessageListResponse, AppStoreError>;

  readonly configureDefaultMessage: (
    productId: string,
    locale: string,
    request: DefaultConfigurationRequest,
  ) => Effect.Effect<void, AppStoreError>;

  readonly deleteDefaultMessage: (
    productId: string,
    locale: string,
  ) => Effect.Effect<void, AppStoreError>;

  readonly getDefaultMessage: (
    productId: string,
    locale: string,
  ) => Effect.Effect<DefaultConfigurationResponse, AppStoreError>;

  // Realtime URL endpoints
  readonly configureRealtimeURL: (
    request: RealtimeUrlRequest,
  ) => Effect.Effect<void, AppStoreError>;

  readonly deleteRealtimeURL: () => Effect.Effect<void, AppStoreError>;

  readonly getRealtimeURL: () => Effect.Effect<RealtimeUrlResponse, AppStoreError>;

  // Performance test endpoints
  readonly initiatePerformanceTest: (
    request: PerformanceTestRequest,
  ) => Effect.Effect<PerformanceTestResponse, AppStoreError>;

  readonly getPerformanceTestResults: (
    requestId: string,
  ) => Effect.Effect<PerformanceTestResultResponse, AppStoreError>;
}

const getBaseUrl = (environment: (typeof Environment)[keyof typeof Environment]) => {
  switch (environment) {
    case Environment.PRODUCTION:
      return PRODUCTION_URL;
    case Environment.SANDBOX:
      return SANDBOX_URL;
    case Environment.LOCAL_TESTING:
      return LOCAL_TESTING_URL;
    case Environment.XCODE:
      throw new Error("Xcode is not a supported environment for an AppStoreServerSdkClient");
    default:
      return PRODUCTION_URL;
  }
};

const appendQueryParamOption = <T>(
  queryParams: Record<string, string[]>,
  key: string,
  value: Option.Option<T>,
  map: (value: T) => string[] = (item) => [String(item)],
) => {
  if (Option.isSome(value)) {
    queryParams[key] = map(value.value);
  }
};

const optionFromRecord = (
  queryParams: Record<string, string[]>,
): Option.Option<Record<string, string[]>> =>
  Object.keys(queryParams).length > 0 ? Option.some(queryParams) : Option.none();

const asOption = <T>(value: Option.Option<T> | T | null | undefined): Option.Option<T> =>
  Option.isOption(value) ? value : Option.fromNullishOr(value);

const toJsonValue = (value: unknown): unknown => {
  if (Option.isOption(value)) {
    return Option.match(value, {
      onNone: () => undefined,
      onSome: toJsonValue,
    });
  }
  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, toJsonValue(item)] as const)
        .filter(([, item]) => item !== undefined),
    );
  }
  return value;
};

const encodeRequestBody = <T>(request: T, schema: EncodableSchema<T>): Effect.Effect<unknown> =>
  Schema.encodeUnknownEffect(schema)(request).pipe(
    Effect.catch(() => Effect.sync(() => toJsonValue(request))),
  );

export const AppStoreServerSdkClient = {
  /**
   * Build a per-tenant App Store Server API client over the shared
   * {@link AppStoreServerSdk}. Captures the credentials in closure; methods
   * regenerate a fresh bearer token per request (Apple mandates 5-minute
   * token expiry, so caching across requests provides little benefit).
   */
  make: (
    sdk: typeof AppStoreServerSdk.Service,
    config: AppStoreServerSdkClientConfig,
  ): AppStoreServerSdkClient => {
    const baseUrl = getBaseUrl(config.environment);
    const httpClient = sdk.httpClient;

    const makeRequest = <T>(
      path: string,
      method: "GET" | "POST" | "PUT" | "DELETE",
      queryParams: Option.Option<Record<string, string[]>>,
      body: Option.Option<unknown>,
      responseSchema: Option.Option<DecodableSchema<T>>,
      contentType: Option.Option<string>,
    ): Effect.Effect<T, AppStoreError> =>
      Effect.gen(function* () {
        const bearerToken = yield* createBearerToken(config).pipe(
          Effect.mapError(
            (e) =>
              new AppStoreJwtError({
                message: e.message,
                cause: Option.some(e),
              }),
          ),
        );

        let url = `${baseUrl}${path}`;
        if (Option.isSome(queryParams)) {
          const params = new URLSearchParams();
          for (const [key, values] of Object.entries(queryParams.value)) {
            for (const value of values) {
              params.append(key, value);
            }
          }
          url = `${url}?${params.toString()}`;
        }

        let bodyOption: HttpBody.HttpBody = HttpBody.empty;
        if (Option.isSome(body)) {
          if (body.value instanceof Uint8Array) {
            bodyOption = HttpBody.uint8Array(
              body.value,
              Option.getOrElse(contentType, () => "image/png"),
            );
          } else {
            bodyOption = HttpBody.jsonUnsafe(body.value);
          }
        }

        const request = HttpClientRequest.make(method)(url, {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
          body: bodyOption,
        });

        const response = yield* httpClient.execute(request).pipe(
          Effect.mapError(
            (e: HttpClientError.HttpClientError) =>
              new AppStoreNetworkError({
                message: `HTTP request failed: ${e.message}`,
                cause: Option.some(e),
              }),
          ),
        );

        if (response.status >= 200 && response.status < 300) {
          if (Option.isNone(responseSchema)) {
            return undefined as T;
          }

          const json = yield* response.json.pipe(
            Effect.mapError(
              () =>
                new AppStoreParseError({
                  httpStatusCode: response.status,
                  message: "Failed to parse response JSON",
                }),
            ),
          );

          const parsed = yield* Schema.decodeUnknownEffect(responseSchema.value)(json).pipe(
            Effect.mapError(
              (_e: Schema.SchemaError) =>
                new AppStoreSchemaError({
                  httpStatusCode: response.status,
                  message: "Unexpected response body format",
                }),
            ),
          );

          return parsed;
        }

        const errorBody = yield* response.json.pipe(Effect.catch(() => Effect.succeed({})));

        const errorCode = Option.fromNullishOr(
          typeof errorBody === "object" && errorBody !== null && "errorCode" in errorBody
            ? (errorBody.errorCode as number)
            : undefined,
        );
        const errorMessage = Option.fromNullishOr(
          typeof errorBody === "object" && errorBody !== null && "errorMessage" in errorBody
            ? (errorBody.errorMessage as string)
            : undefined,
        );

        return yield* Effect.fail(createAppStoreApiError(response.status, errorCode, errorMessage));
      });

    return {
      // Transaction endpoints
      getTransactionInfo: (transactionId) =>
        makeRequest(
          `/inApps/v1/transactions/${transactionId}`,
          "GET",
          Option.none(),
          Option.none(),
          Option.some(TransactionInfoResponseSchema),
          Option.none(),
        ),

      getTransactionHistory: (transactionId, revision, request, version) => {
        const queryParams: Record<string, string[]> = {};
        const revisionOption = asOption(revision);
        const versionOption = asOption(version);
        appendQueryParamOption(queryParams, "revision", revisionOption);
        appendQueryParamOption(queryParams, "startDate", asOption(request.startDate));
        appendQueryParamOption(queryParams, "endDate", asOption(request.endDate));
        appendQueryParamOption(queryParams, "productId", asOption(request.productIds), (values) => [
          ...values,
        ]);
        appendQueryParamOption(
          queryParams,
          "productType",
          asOption(request.productTypes),
          (values) => [...values],
        );
        appendQueryParamOption(queryParams, "sort", asOption(request.sort));
        appendQueryParamOption(
          queryParams,
          "subscriptionGroupIdentifier",
          asOption(request.subscriptionGroupIdentifiers),
          (values) => [...values],
        );
        appendQueryParamOption(
          queryParams,
          "inAppOwnershipType",
          asOption(request.inAppOwnershipType),
        );
        appendQueryParamOption(queryParams, "revoked", asOption(request.revoked));
        const historyVersion = Option.getOrElse(
          versionOption,
          () => GetTransactionHistoryVersion.V1,
        );

        return makeRequest(
          `/inApps/${historyVersion}/history/${transactionId}`,
          "GET",
          optionFromRecord(queryParams),
          Option.none(),
          Option.some(HistoryResponseSchema),
          Option.none(),
        );
      },

      getRefundHistory: (transactionId, revision) => {
        const queryParams: Record<string, string[]> = {};
        appendQueryParamOption(queryParams, "revision", asOption(revision));

        return makeRequest(
          `/inApps/v2/refund/lookup/${transactionId}`,
          "GET",
          optionFromRecord(queryParams),
          Option.none(),
          Option.some(RefundHistoryResponseSchema),
          Option.none(),
        );
      },

      lookUpOrderId: (orderId) =>
        makeRequest(
          `/inApps/v1/lookup/${orderId}`,
          "GET",
          Option.none(),
          Option.none(),
          Option.some(OrderLookupResponseSchema),
          Option.none(),
        ),

      setAppAccountToken: (originalTransactionId, request) =>
        encodeRequestBody(request, UpdateAppAccountTokenRequestSchema).pipe(
          Effect.flatMap((body) =>
            makeRequest(
              `/inApps/v1/transactions/${originalTransactionId}/appAccountToken`,
              "PUT",
              Option.none(),
              Option.some(body),
              Option.none(),
              Option.some("application/json"),
            ),
          ),
        ),

      getAppTransactionInfo: (transactionId) =>
        makeRequest(
          `/inApps/v1/transactions/appTransactions/${transactionId}`,
          "GET",
          Option.none(),
          Option.none(),
          Option.some(AppTransactionInfoResponseSchema),
          Option.none(),
        ),

      // Subscription endpoints
      getAllSubscriptionStatuses: (transactionId, status) => {
        const queryParams: Record<string, string[]> = {};
        appendQueryParamOption(queryParams, "status", asOption(status), (values) =>
          values.map((s) => s.toString()),
        );

        return makeRequest(
          `/inApps/v1/subscriptions/${transactionId}`,
          "GET",
          optionFromRecord(queryParams),
          Option.none(),
          Option.some(StatusResponseSchema),
          Option.none(),
        );
      },

      extendSubscriptionRenewalDate: (originalTransactionId, request) =>
        encodeRequestBody(request, ExtendRenewalDateRequestSchema).pipe(
          Effect.flatMap((body) =>
            makeRequest(
              `/inApps/v1/subscriptions/extend/${originalTransactionId}`,
              "PUT",
              Option.none(),
              Option.some(body),
              Option.some(ExtendRenewalDateResponseSchema),
              Option.some("application/json"),
            ),
          ),
        ),

      extendRenewalDateForAllActiveSubscribers: (request) =>
        encodeRequestBody(request, MassExtendRenewalDateRequestSchema).pipe(
          Effect.flatMap((body) =>
            makeRequest(
              "/inApps/v1/subscriptions/extend/mass",
              "POST",
              Option.none(),
              Option.some(body),
              Option.some(MassExtendRenewalDateResponseSchema),
              Option.some("application/json"),
            ),
          ),
        ),

      getStatusOfSubscriptionRenewalDateExtensions: (requestIdentifier, productId) =>
        makeRequest(
          `/inApps/v1/subscriptions/extend/mass/${productId}/${requestIdentifier}`,
          "GET",
          Option.none(),
          Option.none(),
          Option.some(MassExtendRenewalDateStatusResponseSchema),
          Option.none(),
        ),

      // Consumption endpoints
      sendConsumptionInformation: (transactionId, request) =>
        encodeRequestBody(request, ConsumptionRequestSchema).pipe(
          Effect.flatMap((body) =>
            makeRequest(
              `/inApps/v2/transactions/consumption/${transactionId}`,
              "PUT",
              Option.none(),
              Option.some(body),
              Option.none(),
              Option.some("application/json"),
            ),
          ),
        ),

      sendConsumptionData: (transactionId, request) =>
        encodeRequestBody(request, ConsumptionRequestV1Schema).pipe(
          Effect.flatMap((body) =>
            makeRequest(
              `/inApps/v1/transactions/consumption/${transactionId}`,
              "PUT",
              Option.none(),
              Option.some(body),
              Option.none(),
              Option.some("application/json"),
            ),
          ),
        ),

      finishTransaction: (transactionId) =>
        makeRequest(
          `/inApps/v1/transactions/${transactionId}/finish`,
          "POST",
          Option.none(),
          Option.none(),
          Option.none(),
          Option.none(),
        ),

      // Notification endpoints
      requestTestNotification: () =>
        makeRequest(
          "/inApps/v1/notifications/test",
          "POST",
          Option.none(),
          Option.none(),
          Option.some(SendTestNotificationResponseSchema),
          Option.none(),
        ),

      getTestNotificationStatus: (testNotificationToken) =>
        makeRequest(
          `/inApps/v1/notifications/test/${testNotificationToken}`,
          "GET",
          Option.none(),
          Option.none(),
          Option.some(CheckTestNotificationResponseSchema),
          Option.none(),
        ),

      getNotificationHistory: (paginationToken, request) => {
        const queryParams: Record<string, string[]> = {};
        appendQueryParamOption(queryParams, "paginationToken", asOption(paginationToken));

        return encodeRequestBody(request, NotificationHistoryRequestSchema).pipe(
          Effect.flatMap((body) =>
            makeRequest(
              "/inApps/v1/notifications/history",
              "POST",
              optionFromRecord(queryParams),
              Option.some(body),
              Option.some(NotificationHistoryResponseSchema),
              Option.some("application/json"),
            ),
          ),
        );
      },

      // Messaging endpoints
      uploadImage: (imageIdentifier, image, imageSize) => {
        const queryParams: Record<string, string[]> = {};
        appendQueryParamOption(queryParams, "imageSize", asOption(imageSize));
        return makeRequest(
          `/inApps/v1/messaging/image/${imageIdentifier}`,
          "PUT",
          optionFromRecord(queryParams),
          Option.some(image),
          Option.none(),
          Option.some("image/png"),
        );
      },

      deleteImage: (imageIdentifier) =>
        makeRequest(
          `/inApps/v1/messaging/image/${imageIdentifier}`,
          "DELETE",
          Option.none(),
          Option.none(),
          Option.none(),
          Option.none(),
        ),

      getImageList: () =>
        makeRequest(
          "/inApps/v1/messaging/image/list",
          "GET",
          Option.none(),
          Option.none(),
          Option.some(GetImageListResponseSchema),
          Option.none(),
        ),

      uploadMessage: (messageIdentifier, request) =>
        encodeRequestBody(request, UploadMessageRequestBodySchema).pipe(
          Effect.flatMap((body) =>
            makeRequest(
              `/inApps/v1/messaging/message/${messageIdentifier}`,
              "PUT",
              Option.none(),
              Option.some(body),
              Option.none(),
              Option.some("application/json"),
            ),
          ),
        ),

      deleteMessage: (messageIdentifier) =>
        makeRequest(
          `/inApps/v1/messaging/message/${messageIdentifier}`,
          "DELETE",
          Option.none(),
          Option.none(),
          Option.none(),
          Option.none(),
        ),

      getMessageList: () =>
        makeRequest(
          "/inApps/v1/messaging/message/list",
          "GET",
          Option.none(),
          Option.none(),
          Option.some(GetMessageListResponseSchema),
          Option.none(),
        ),

      configureDefaultMessage: (productId, locale, request) =>
        encodeRequestBody(request, DefaultConfigurationRequestSchema).pipe(
          Effect.flatMap((body) =>
            makeRequest(
              `/inApps/v1/messaging/default/${productId}/${locale}`,
              "PUT",
              Option.none(),
              Option.some(body),
              Option.none(),
              Option.some("application/json"),
            ),
          ),
        ),

      deleteDefaultMessage: (productId, locale) =>
        makeRequest(
          `/inApps/v1/messaging/default/${productId}/${locale}`,
          "DELETE",
          Option.none(),
          Option.none(),
          Option.none(),
          Option.none(),
        ),

      getDefaultMessage: (productId, locale) =>
        makeRequest(
          `/inApps/v1/messaging/default/${productId}/${locale}`,
          "GET",
          Option.none(),
          Option.none(),
          Option.some(DefaultConfigurationResponseSchema),
          Option.none(),
        ),

      // Realtime URL endpoints
      configureRealtimeURL: (request) =>
        encodeRequestBody(request, RealtimeUrlRequestSchema).pipe(
          Effect.flatMap((body) =>
            makeRequest(
              "/inApps/v1/messaging/realtime/url",
              "PUT",
              Option.none(),
              Option.some(body),
              Option.none(),
              Option.some("application/json"),
            ),
          ),
        ),

      deleteRealtimeURL: () =>
        makeRequest(
          "/inApps/v1/messaging/realtime/url",
          "DELETE",
          Option.none(),
          Option.none(),
          Option.none(),
          Option.none(),
        ),

      getRealtimeURL: () =>
        makeRequest(
          "/inApps/v1/messaging/realtime/url",
          "GET",
          Option.none(),
          Option.none(),
          Option.some(RealtimeUrlResponseSchema),
          Option.none(),
        ),

      // Performance test endpoints
      initiatePerformanceTest: (request) =>
        encodeRequestBody(request, PerformanceTestRequestSchema).pipe(
          Effect.flatMap((body) =>
            makeRequest(
              "/inApps/v1/messaging/performanceTest",
              "POST",
              Option.none(),
              Option.some(body),
              Option.some(PerformanceTestResponseSchema),
              Option.some("application/json"),
            ),
          ),
        ),

      getPerformanceTestResults: (requestId) =>
        makeRequest(
          `/inApps/v1/messaging/performanceTest/result/${requestId}`,
          "GET",
          Option.none(),
          Option.none(),
          Option.some(PerformanceTestResultResponseSchema),
          Option.none(),
        ),
    };
  },
};

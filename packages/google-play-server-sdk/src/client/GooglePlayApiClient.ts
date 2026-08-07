import { Effect, Schema } from "effect";

import { GooglePlayGeneralError } from "../errors/client-errors.ts";
import {
  GooglePlayForbiddenError,
  GooglePlayInvalidRequestError,
  GooglePlayPurchaseNotFoundError,
  GooglePlayRateLimitExceededError,
  GooglePlaySubscriptionNotFoundError,
  GooglePlayProductNotFoundError,
  GooglePlayUnauthorizedError,
} from "../errors/api-errors.ts";
import * as Schemas from "../schemas/index.ts";
import type { GooglePlayAuthClient } from "./auth.ts";
import { createAuthClient, getAccessToken, createAuthHeaders } from "./auth.ts";

const GOOGLE_PLAY_API_BASE = "https://androidpublisher.googleapis.com";

const redactPurchaseTokens = (path: string): string =>
  path.replace(/(\/tokens\/)[^/:?]+/g, "$1[redacted]");

/**
 * Appends the encoded query string to `path`, omitting the `?` entirely when
 * no parameters were set.
 */
const withQuery = (path: string, params: URLSearchParams): string => {
  const queryString = params.toString();
  if (!queryString) {
    return path;
  }
  return `${path}?${queryString}`;
};

/** Builds the acknowledge/consume request body, omitted when no payload is set. */
const developerPayloadBody = (developerPayload?: string) => {
  if (!developerPayload) {
    return undefined;
  }
  return { developerPayload };
};

/** Parses a `Retry-After` header value, ignoring absent or unparsable values. */
const parseRetryAfterSeconds = (retryAfter: string | null) => {
  if (!retryAfter) {
    return undefined;
  }
  return Number.parseInt(retryAfter);
};

/** Tolerant shape of a Google Play API error payload. */
const ApiErrorBody = Schema.Struct({
  error: Schema.optional(
    Schema.Struct({
      message: Schema.optional(Schema.String),
      code: Schema.optional(Schema.Number),
    }),
  ),
});

type ApiErrorBodyType = typeof ApiErrorBody.Type;

/** Response body of the legacy subscription defer endpoint. */
const SubscriptionDeferResponse = Schema.Struct({
  newExpiryTimeMillis: Schema.String,
});

/**
 * Serializes an optional request body to JSON text, keeping `undefined` when
 * the request carries no body at all.
 */
const encodeRequestBody = (
  body: unknown,
): Effect.Effect<string | undefined, GooglePlayGeneralError> => {
  if (!body) {
    return Effect.succeed(undefined);
  }
  return Schema.encodeUnknownEffect(Schema.UnknownFromJsonString)(body).pipe(
    Effect.mapError(
      (cause) =>
        new GooglePlayGeneralError({
          message: "Failed to encode Google Play API request body",
          cause,
        }),
    ),
  );
};

// ============================================================================
// Result Types
// ============================================================================

export interface SubscriptionPurchaseV2Result {
  subscriptionPurchase: Schemas.SubscriptionPurchaseV2Type;
}

export interface ProductPurchaseResult {
  productPurchase: Schemas.ProductPurchaseType;
}

export interface ProductPurchaseV2Result {
  productPurchase: Schemas.ProductPurchaseV2Type;
}

export interface VoidedPurchasesResult {
  voidedPurchases: Schemas.VoidedPurchasesListResponseType;
}

export interface SubscriptionDeferResult {
  newExpiryTimeMillis: string;
}

// ============================================================================
// HTTP Request Helper
// ============================================================================

interface ApiRequestOptions {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  auth: GooglePlayAuthClient;
  packageName: string;
}

/**
 * Maps a non-2xx Google Play response onto the matching tagged error. The
 * status, the raw response text and the tolerantly decoded error payload are
 * all the classification needs.
 */
const classifyApiFailure = (options: ApiRequestOptions, response: Response, responseText: string) =>
  Effect.gen(function* () {
    const rawBody = yield* Schema.decodeUnknownEffect(Schema.UnknownFromJsonString)(
      responseText,
    ).pipe(Effect.orElseSucceed(() => undefined));
    const body = yield* Schema.decodeUnknownEffect(ApiErrorBody)(rawBody).pipe(
      Effect.orElseSucceed((): ApiErrorBodyType => ({})),
    );
    const errorMessage = body.error?.message ?? "Google Play API request failed";

    if (response.status === 404) {
      // Extract purchase token from path if available
      const tokenMatch = options.path.match(/\/tokens\/([^/:]+)/);
      const purchaseToken = tokenMatch?.[1] ?? "";

      // Check if it's a subscription or product not found
      if (options.path.includes("/subscriptions/")) {
        const productMatch = options.path.match(/\/subscriptions\/([^/]+)/);
        if (productMatch?.[1] && !options.path.includes("/purchases/subscriptions")) {
          return yield* new GooglePlaySubscriptionNotFoundError({
            productId: productMatch[1],
            packageName: options.packageName,
          });
        }
      }

      if (options.path.includes("/oneTimeProducts/") || options.path.includes("/onetimeproducts/")) {
        const productMatch = options.path.match(/\/(?:oneTimeProducts|onetimeproducts)\/([^/]+)/);
        if (productMatch?.[1]) {
          return yield* new GooglePlayProductNotFoundError({
            productId: productMatch[1],
            packageName: options.packageName,
          });
        }
      }

      return yield* new GooglePlayPurchaseNotFoundError({
        purchaseToken,
        packageName: options.packageName,
      });
    }

    if (response.status === 401) {
      return yield* new GooglePlayUnauthorizedError({
        message: errorMessage,
      });
    }

    if (response.status === 403) {
      return yield* new GooglePlayForbiddenError({
        message: errorMessage,
      });
    }

    if (response.status === 429) {
      return yield* new GooglePlayRateLimitExceededError({
        message: errorMessage,
        retryAfterSeconds: parseRetryAfterSeconds(response.headers.get("Retry-After")),
      });
    }

    if (response.status === 400) {
      return yield* new GooglePlayInvalidRequestError({
        message: errorMessage,
        details: rawBody,
      });
    }

    return yield* new GooglePlayGeneralError({
      message: errorMessage,
      cause: responseText,
    });
  });

/**
 * Performs one authenticated Android Publisher request and returns the decoded
 * JSON payload as `unknown`; callers narrow it with the matching schema.
 *
 * Uses the global `fetch` rather than `HttpClient` on purpose so the SDK stays
 * free of service requirements on Cloudflare Workers.
 */
const makeApiRequest = (options: ApiRequestOptions) =>
  Effect.gen(function* () {
    const accessToken = yield* getAccessToken(options.auth);
    const headers = createAuthHeaders(accessToken);
    const url = `${GOOGLE_PLAY_API_BASE}${options.path}`;

    yield* Effect.logDebug("Making Google Play API request", {
      method: options.method,
      path: redactPurchaseTokens(options.path),
    });

    const transportFailure = (cause: unknown) =>
      new GooglePlayGeneralError({
        message: "Google Play API request failed",
        cause,
      });

    const body = yield* encodeRequestBody(options.body);

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          method: options.method,
          headers,
          body,
        }),
      catch: transportFailure,
    });

    // Handle empty responses (204, etc.)
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return {};
    }

    const responseText = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: transportFailure,
    });

    if (!response.ok) {
      return yield* classifyApiFailure(options, response, responseText);
    }

    return yield* Schema.decodeUnknownEffect(Schema.UnknownFromJsonString)(responseText).pipe(
      Effect.mapError(transportFailure),
    );
  });

// ============================================================================
// Initialize SDK
// ============================================================================

export const initializeSdk = Effect.sync(() =>
  Effect.fn("initializeSdk")(function* initializeSdk(input: {
    serviceAccountKey: string;
    packageName: string;
  }) {
    const auth = yield* createAuthClient({
      serviceAccountKey: input.serviceAccountKey,
    });

    const basePath = `/androidpublisher/v3/applications/${input.packageName}`;

    return {
      // ======================================================================
      // Subscriptions V2 - Purchase Verification
      // ======================================================================

      /**
       * Gets subscription purchase metadata using subscriptions V2 API
       * @param purchaseToken - The purchase token from the client
       */
      getSubscriptionV2: (purchaseToken: string) =>
        Effect.gen(function* () {
          yield* Effect.logDebug("Getting subscription V2");

          const result = yield* makeApiRequest({
            method: "GET",
            path: `${basePath}/purchases/subscriptionsv2/tokens/${purchaseToken}`,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.SubscriptionPurchaseV2)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse subscription response",
                  cause: parseError,
                }),
            ),
          );
        }),

      /**
       * Cancels a subscription at the end of the current billing period
       * @param purchaseToken - The purchase token
       */
      cancelSubscription: (purchaseToken: string) =>
        makeApiRequest({
          method: "POST",
          path: `${basePath}/purchases/subscriptionsv2/tokens/${purchaseToken}:cancel`,
          auth,
          packageName: input.packageName,
        }).pipe(Effect.asVoid),

      /**
       * Revokes a subscription immediately
       * @param purchaseToken - The purchase token
       */
      revokeSubscription: (purchaseToken: string) =>
        makeApiRequest({
          method: "POST",
          path: `${basePath}/purchases/subscriptionsv2/tokens/${purchaseToken}:revoke`,
          auth,
          packageName: input.packageName,
        }).pipe(Effect.asVoid),

      // ======================================================================
      // Subscriptions V1 - Legacy Operations
      // ======================================================================

      /**
       * Acknowledges a subscription purchase
       * @param subscriptionId - The subscription product ID
       * @param purchaseToken - The purchase token
       * @param developerPayload - Optional payload to attach
       */
      acknowledgeSubscription: (
        subscriptionId: string,
        purchaseToken: string,
        developerPayload?: string,
      ) =>
        makeApiRequest({
          method: "POST",
          path: `${basePath}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}:acknowledge`,
          body: developerPayloadBody(developerPayload),
          auth,
          packageName: input.packageName,
        }).pipe(Effect.asVoid),

      /**
       * Defers subscription renewal to a later date
       * @param subscriptionId - The subscription product ID
       * @param purchaseToken - The purchase token
       * @param expectedExpiryTimeMillis - Current expected expiry time (for validation)
       * @param desiredExpiryTimeMillis - New desired expiry time
       */
      deferSubscription: (
        subscriptionId: string,
        purchaseToken: string,
        expectedExpiryTimeMillis: string,
        desiredExpiryTimeMillis: string,
      ) =>
        Effect.gen(function* () {
          const result = yield* makeApiRequest({
            method: "POST",
            path: `${basePath}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}:defer`,
            body: {
              deferralInfo: {
                expectedExpiryTimeMillis,
                desiredExpiryTimeMillis,
              },
            },
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(SubscriptionDeferResponse)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse subscription defer response",
                  cause: parseError,
                }),
            ),
          );
        }),

      // ======================================================================
      // Products V2 - Purchase Verification
      // ======================================================================

      /**
       * Gets product purchase using products V2 API
       * @param purchaseToken - The purchase token
       */
      getProductV2: (purchaseToken: string) =>
        Effect.gen(function* () {
          yield* Effect.logDebug("Getting product V2");

          const result = yield* makeApiRequest({
            method: "GET",
            path: `${basePath}/purchases/productsv2/tokens/${purchaseToken}`,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.ProductPurchaseV2)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse product purchase V2 response",
                  cause: parseError,
                }),
            ),
          );
        }),

      // ======================================================================
      // Products V1 - Legacy Operations
      // ======================================================================

      /**
       * Gets product purchase status (legacy V1 API)
       * @param productId - The product ID
       * @param purchaseToken - The purchase token
       */
      getProduct: (productId: string, purchaseToken: string) =>
        Effect.gen(function* () {
          yield* Effect.logDebug("Getting product V1", {
            productId,
          });

          const result = yield* makeApiRequest({
            method: "GET",
            path: `${basePath}/purchases/products/${productId}/tokens/${purchaseToken}`,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.ProductPurchase)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse product purchase response",
                  cause: parseError,
                }),
            ),
          );
        }),

      /**
       * Acknowledges a product purchase
       * @param productId - The product ID
       * @param purchaseToken - The purchase token
       * @param developerPayload - Optional payload to attach
       */
      acknowledgeProduct: (productId: string, purchaseToken: string, developerPayload?: string) =>
        makeApiRequest({
          method: "POST",
          path: `${basePath}/purchases/products/${productId}/tokens/${purchaseToken}:acknowledge`,
          body: developerPayloadBody(developerPayload),
          auth,
          packageName: input.packageName,
        }).pipe(Effect.asVoid),

      /**
       * Consumes a product purchase (for consumable products)
       * @param productId - The product ID
       * @param purchaseToken - The purchase token
       */
      consumeProduct: (productId: string, purchaseToken: string) =>
        makeApiRequest({
          method: "POST",
          path: `${basePath}/purchases/products/${productId}/tokens/${purchaseToken}:consume`,
          auth,
          packageName: input.packageName,
        }).pipe(Effect.asVoid),

      // ======================================================================
      // Voided Purchases
      // ======================================================================

      /**
       * Lists voided purchases (refunds, chargebacks)
       * @param options - Optional filters
       */
      getVoidedPurchases: (options?: {
        startTime?: string;
        endTime?: string;
        maxResults?: number;
        token?: string;
        type?: 0 | 1; // 0 = subscription, 1 = in-app product
      }) =>
        Effect.gen(function* () {
          const params = new URLSearchParams();
          if (options?.startTime) params.append("startTime", options.startTime);
          if (options?.endTime) params.append("endTime", options.endTime);
          if (options?.maxResults) params.append("maxResults", String(options.maxResults));
          if (options?.token) params.append("token", options.token);
          if (options?.type !== undefined) params.append("type", String(options.type));

          const path = withQuery(`${basePath}/purchases/voidedpurchases`, params);

          const result = yield* makeApiRequest({
            method: "GET",
            path,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.VoidedPurchasesListResponse)(
            result,
          ).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse voided purchases response",
                  cause: parseError,
                }),
            ),
          );
        }),

      // ======================================================================
      // Monetization - Subscriptions
      // ======================================================================

      /**
       * Creates a new subscription product
       * @param subscription - The subscription configuration
       */
      createSubscription: (subscription: Schemas.SubscriptionType) =>
        Effect.gen(function* () {
          const result = yield* makeApiRequest({
            method: "POST",
            path: `${basePath}/subscriptions?productId=${subscription.productId}`,
            body: subscription,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.Subscription)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse subscription response",
                  cause: parseError,
                }),
            ),
          );
        }),

      /**
       * Gets a subscription product
       * @param productId - The subscription product ID
       */
      getSubscription: (productId: string) =>
        Effect.gen(function* () {
          const result = yield* makeApiRequest({
            method: "GET",
            path: `${basePath}/subscriptions/${productId}`,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.Subscription)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse subscription response",
                  cause: parseError,
                }),
            ),
          );
        }),

      /**
       * Lists all subscription products
       * @param pageToken - Optional pagination token
       * @param pageSize - Optional page size
       */
      listSubscriptions: (pageToken?: string, pageSize?: number) =>
        Effect.gen(function* () {
          const params = new URLSearchParams();
          if (pageToken) params.append("pageToken", pageToken);
          if (pageSize) params.append("pageSize", String(pageSize));

          const path = withQuery(`${basePath}/subscriptions`, params);

          const result = yield* makeApiRequest({
            method: "GET",
            path,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.ListSubscriptionsResponse)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse subscriptions list response",
                  cause: parseError,
                }),
            ),
          );
        }),

      /**
       * Updates a subscription product
       * @param productId - The subscription product ID
       * @param subscription - The updated subscription configuration
       * @param updateMask - Fields to update (e.g., "listings,basePlans")
       */
      updateSubscription: (
        productId: string,
        subscription: Partial<Schemas.SubscriptionType>,
        updateMask?: string,
      ) =>
        Effect.gen(function* () {
          const params = new URLSearchParams();
          if (updateMask) params.append("updateMask", updateMask);

          const path = withQuery(`${basePath}/subscriptions/${productId}`, params);

          const result = yield* makeApiRequest({
            method: "PATCH",
            path,
            body: subscription,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.Subscription)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse subscription response",
                  cause: parseError,
                }),
            ),
          );
        }),

      /**
       * Deletes a subscription product
       * @param productId - The subscription product ID
       */
      deleteSubscription: (productId: string) =>
        makeApiRequest({
          method: "DELETE",
          path: `${basePath}/subscriptions/${productId}`,
          auth,
          packageName: input.packageName,
        }).pipe(Effect.asVoid),

      // ======================================================================
      // Monetization - Base Plans
      // ======================================================================

      /**
       * Activates a base plan
       * @param productId - The subscription product ID
       * @param basePlanId - The base plan ID
       */
      activateBasePlan: (productId: string, basePlanId: string) =>
        Effect.gen(function* () {
          const result = yield* makeApiRequest({
            method: "POST",
            path: `${basePath}/subscriptions/${productId}/basePlans/${basePlanId}:activate`,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.Subscription)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse subscription response",
                  cause: parseError,
                }),
            ),
          );
        }),

      /**
       * Deactivates a base plan
       * @param productId - The subscription product ID
       * @param basePlanId - The base plan ID
       */
      deactivateBasePlan: (productId: string, basePlanId: string) =>
        Effect.gen(function* () {
          const result = yield* makeApiRequest({
            method: "POST",
            path: `${basePath}/subscriptions/${productId}/basePlans/${basePlanId}:deactivate`,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.Subscription)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse subscription response",
                  cause: parseError,
                }),
            ),
          );
        }),

      // ======================================================================
      // Monetization - Subscription Offers
      // ======================================================================

      /**
       * Creates a subscription offer
       * @param productId - The subscription product ID
       * @param basePlanId - The base plan ID
       * @param offer - The offer configuration
       */
      createSubscriptionOffer: (
        productId: string,
        basePlanId: string,
        offer: Schemas.SubscriptionOfferType,
      ) =>
        Effect.gen(function* () {
          const result = yield* makeApiRequest({
            method: "POST",
            path: `${basePath}/subscriptions/${productId}/basePlans/${basePlanId}/offers?offerId=${offer.offerId}`,
            body: offer,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.SubscriptionOffer)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse subscription offer response",
                  cause: parseError,
                }),
            ),
          );
        }),

      /**
       * Activates a subscription offer
       * @param productId - The subscription product ID
       * @param basePlanId - The base plan ID
       * @param offerId - The offer ID
       */
      activateSubscriptionOffer: (productId: string, basePlanId: string, offerId: string) =>
        Effect.gen(function* () {
          const result = yield* makeApiRequest({
            method: "POST",
            path: `${basePath}/subscriptions/${productId}/basePlans/${basePlanId}/offers/${offerId}:activate`,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.SubscriptionOffer)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse subscription offer response",
                  cause: parseError,
                }),
            ),
          );
        }),

      /**
       * Deactivates a subscription offer
       * @param productId - The subscription product ID
       * @param basePlanId - The base plan ID
       * @param offerId - The offer ID
       */
      deactivateSubscriptionOffer: (productId: string, basePlanId: string, offerId: string) =>
        Effect.gen(function* () {
          const result = yield* makeApiRequest({
            method: "POST",
            path: `${basePath}/subscriptions/${productId}/basePlans/${basePlanId}/offers/${offerId}:deactivate`,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.SubscriptionOffer)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse subscription offer response",
                  cause: parseError,
                }),
            ),
          );
        }),

      // ======================================================================
      // Monetization - One-Time Products
      // ======================================================================

      /**
       * Creates or updates a one-time product
       * @param productId - The product ID
       * @param product - The product configuration
       */
      createOneTimeProduct: (productId: string, product: Schemas.OneTimeProductType) =>
        Effect.gen(function* () {
          const result = yield* makeApiRequest({
            method: "PATCH",
            path: `${basePath}/oneTimeProducts/${productId}`,
            body: product,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.OneTimeProduct)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse one-time product response",
                  cause: parseError,
                }),
            ),
          );
        }),

      /**
       * Gets a one-time product
       * @param productId - The product ID
       */
      getOneTimeProduct: (productId: string) =>
        Effect.gen(function* () {
          const result = yield* makeApiRequest({
            method: "GET",
            path: `${basePath}/oneTimeProducts/${productId}`,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.OneTimeProduct)(result).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse one-time product response",
                  cause: parseError,
                }),
            ),
          );
        }),

      /**
       * Lists all one-time products
       * @param pageToken - Optional pagination token
       * @param pageSize - Optional page size
       */
      listOneTimeProducts: (pageToken?: string, pageSize?: number) =>
        Effect.gen(function* () {
          const params = new URLSearchParams();
          if (pageToken) params.append("pageToken", pageToken);
          if (pageSize) params.append("pageSize", String(pageSize));

          const path = withQuery(`${basePath}/oneTimeProducts`, params);

          const result = yield* makeApiRequest({
            method: "GET",
            path,
            auth,
            packageName: input.packageName,
          });

          return yield* Schema.decodeUnknownEffect(Schemas.ListOneTimeProductsResponse)(
            result,
          ).pipe(
            Effect.mapError(
              (parseError) =>
                new GooglePlayGeneralError({
                  message: "Failed to parse one-time products list response",
                  cause: parseError,
                }),
            ),
          );
        }),

      /**
       * Deletes a one-time product
       * @param productId - The product ID
       */
      deleteOneTimeProduct: (productId: string) =>
        makeApiRequest({
          method: "DELETE",
          path: `${basePath}/oneTimeProducts/${productId}`,
          auth,
          packageName: input.packageName,
        }).pipe(Effect.asVoid),
    };
  }),
);

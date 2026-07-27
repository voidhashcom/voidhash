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

const makeApiRequest = <T>(options: ApiRequestOptions) =>
  Effect.gen(function* () {
    const accessToken = yield* getAccessToken(options.auth);
    const headers = createAuthHeaders(accessToken);
    const url = `${GOOGLE_PLAY_API_BASE}${options.path}`;

    yield* Effect.logDebug("Making Google Play API request", {
      method: options.method,
      path: redactPurchaseTokens(options.path),
    });

    return yield* Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          method: options.method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        // Handle empty responses (204, etc.)
        if (response.status === 204 || response.headers.get("content-length") === "0") {
          return {} as T;
        }

        const responseBody = await response.json();

        if (!response.ok) {
          throw {
            status: response.status,
            body: responseBody,
            headers: response.headers,
          };
        }

        return responseBody as T;
      },
      catch: (cause: unknown) => {
        const error = cause as {
          status?: number;
          body?: { error?: { message?: string; code?: number } };
          headers?: Headers;
        };

        const errorMessage = error.body?.error?.message ?? "Google Play API request failed";

        if (error.status === 404) {
          // Extract purchase token from path if available
          const tokenMatch = options.path.match(/\/tokens\/([^/:]+)/);
          const purchaseToken = tokenMatch?.[1] ?? "";

          // Check if it's a subscription or product not found
          if (options.path.includes("/subscriptions/")) {
            const productMatch = options.path.match(/\/subscriptions\/([^/]+)/);
            if (productMatch?.[1] && !options.path.includes("/purchases/subscriptions")) {
              return new GooglePlaySubscriptionNotFoundError({
                productId: productMatch[1],
                packageName: options.packageName,
              });
            }
          }

          if (
            options.path.includes("/oneTimeProducts/") ||
            options.path.includes("/onetimeproducts/")
          ) {
            const productMatch = options.path.match(
              /\/(?:oneTimeProducts|onetimeproducts)\/([^/]+)/,
            );
            if (productMatch?.[1]) {
              return new GooglePlayProductNotFoundError({
                productId: productMatch[1],
                packageName: options.packageName,
              });
            }
          }

          return new GooglePlayPurchaseNotFoundError({
            purchaseToken,
            packageName: options.packageName,
          });
        }

        if (error.status === 401) {
          return new GooglePlayUnauthorizedError({
            message: errorMessage,
          });
        }

        if (error.status === 403) {
          return new GooglePlayForbiddenError({
            message: errorMessage,
          });
        }

        if (error.status === 429) {
          const retryAfter = error.headers?.get("Retry-After");
          return new GooglePlayRateLimitExceededError({
            message: errorMessage,
            retryAfterSeconds: retryAfter ? Number.parseInt(retryAfter) : undefined,
          });
        }

        if (error.status === 400) {
          return new GooglePlayInvalidRequestError({
            message: errorMessage,
            details: error.body,
          });
        }

        return new GooglePlayGeneralError({
          message: errorMessage,
          cause,
        });
      },
    });
  });

// ============================================================================
// Initialize SDK
// ============================================================================

export const initializeSdk = Effect.gen(function* initializeSdk() {
  return Effect.fn("initializeSdk")(function* initializeSdk(input: {
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

          const result = yield* makeApiRequest<Schemas.SubscriptionPurchaseV2Type>({
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
        makeApiRequest<void>({
          method: "POST",
          path: `${basePath}/purchases/subscriptionsv2/tokens/${purchaseToken}:cancel`,
          auth,
          packageName: input.packageName,
        }),

      /**
       * Revokes a subscription immediately
       * @param purchaseToken - The purchase token
       */
      revokeSubscription: (purchaseToken: string) =>
        makeApiRequest<void>({
          method: "POST",
          path: `${basePath}/purchases/subscriptionsv2/tokens/${purchaseToken}:revoke`,
          auth,
          packageName: input.packageName,
        }),

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
        makeApiRequest<void>({
          method: "POST",
          path: `${basePath}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}:acknowledge`,
          body: developerPayload ? { developerPayload } : undefined,
          auth,
          packageName: input.packageName,
        }),

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
        makeApiRequest<SubscriptionDeferResult>({
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

          const result = yield* makeApiRequest<Schemas.ProductPurchaseV2Type>({
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

          const result = yield* makeApiRequest<Schemas.ProductPurchaseType>({
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
        makeApiRequest<void>({
          method: "POST",
          path: `${basePath}/purchases/products/${productId}/tokens/${purchaseToken}:acknowledge`,
          body: developerPayload ? { developerPayload } : undefined,
          auth,
          packageName: input.packageName,
        }),

      /**
       * Consumes a product purchase (for consumable products)
       * @param productId - The product ID
       * @param purchaseToken - The purchase token
       */
      consumeProduct: (productId: string, purchaseToken: string) =>
        makeApiRequest<void>({
          method: "POST",
          path: `${basePath}/purchases/products/${productId}/tokens/${purchaseToken}:consume`,
          auth,
          packageName: input.packageName,
        }),

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

          const queryString = params.toString();
          const path = `${basePath}/purchases/voidedpurchases${queryString ? `?${queryString}` : ""}`;

          const result = yield* makeApiRequest<Schemas.VoidedPurchasesListResponseType>({
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
          const result = yield* makeApiRequest<Schemas.SubscriptionType>({
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
          const result = yield* makeApiRequest<Schemas.SubscriptionType>({
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

          const queryString = params.toString();
          const path = `${basePath}/subscriptions${queryString ? `?${queryString}` : ""}`;

          const result = yield* makeApiRequest<Schemas.ListSubscriptionsResponseType>({
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

          const queryString = params.toString();
          const path = `${basePath}/subscriptions/${productId}${queryString ? `?${queryString}` : ""}`;

          const result = yield* makeApiRequest<Schemas.SubscriptionType>({
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
        makeApiRequest<void>({
          method: "DELETE",
          path: `${basePath}/subscriptions/${productId}`,
          auth,
          packageName: input.packageName,
        }),

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
          const result = yield* makeApiRequest<Schemas.SubscriptionType>({
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
          const result = yield* makeApiRequest<Schemas.SubscriptionType>({
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
          const result = yield* makeApiRequest<Schemas.SubscriptionOfferType>({
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
          const result = yield* makeApiRequest<Schemas.SubscriptionOfferType>({
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
          const result = yield* makeApiRequest<Schemas.SubscriptionOfferType>({
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
          const result = yield* makeApiRequest<Schemas.OneTimeProductType>({
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
          const result = yield* makeApiRequest<Schemas.OneTimeProductType>({
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

          const queryString = params.toString();
          const path = `${basePath}/oneTimeProducts${queryString ? `?${queryString}` : ""}`;

          const result = yield* makeApiRequest<Schemas.ListOneTimeProductsResponseType>({
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
        makeApiRequest<void>({
          method: "DELETE",
          path: `${basePath}/oneTimeProducts/${productId}`,
          auth,
          packageName: input.packageName,
        }),
    };
  });
});

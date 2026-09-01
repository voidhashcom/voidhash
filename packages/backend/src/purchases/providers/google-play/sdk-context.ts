/**
 * Per-tenant Google Play Developer API helpers shared by the webhook handler,
 * the SDK boundary, and reconciliation. Owns construction of the authenticated
 * Android Publisher client (the SDK mints an OAuth2 access token from the
 * service-account JSON via WebCrypto) and the catalog price resolution that
 * turns a purchase into a billable amount.
 *
 * Unlike Apple, Google does not include the paid amount in the purchase
 * response (`subscriptions.v2.get` returns no price), so revenue is resolved
 * from the subscription catalog's regional base-plan price for the buyer's
 * `regionCode`. Best-effort: a catalog miss yields `Option.none()` so the
 * caller omits money rather than guessing.
 */
import { type MoneyType, initializeSdk } from "@voidhash/google-play-server-sdk";
import { constant } from "@voidhash/lib/lang";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

type GooglePlaySdkClient = Effect.Success<ReturnType<Effect.Success<typeof initializeSdk>>>;

/** Minimal Play Developer API surface used by purchase processing. */
export type GooglePlayServerApiClient = Pick<
  GooglePlaySdkClient,
  "getProductV2" | "getSubscription" | "getSubscriptionV2" | "getVoidedPurchases"
>;

/** Inputs exposed to an optional runtime-specific Play API client factory. */
export type GooglePlayServerApiClientFactoryInput = Parameters<
  Effect.Success<typeof initializeSdk>
>[0];

/** Supplies a Play API client for a configuration when overridden. */
export type GooglePlayServerApiClientFactory = (
  input: GooglePlayServerApiClientFactoryInput,
) => GooglePlayServerApiClient | typeof Schema.Undefined.Type;

/** Optional Play API client factory override for hermetic runtime composition. */
export const GooglePlayServerApiClientFactoryOverride = Context.Reference<
  GooglePlayServerApiClientFactory | typeof Schema.Undefined.Type
>("@voidhash/backend/purchases/GooglePlayServerApiClientFactoryOverride", {
  defaultValue: () => undefined,
});

/**
 * Thin Effect service exposing the Google Play SDK builder. Mirrors the App
 * Store `AppStoreServerSdk` service — resolved once, then used to build a
 * per-tenant client from the decrypted service-account key.
 */
export class GooglePlayServerApi extends Context.Service<GooglePlayServerApi>()(
  "@voidhash/backend/purchases/GooglePlayServerApi",
  {
    make: Effect.gen(function* () {
      const realBuildClient = yield* initializeSdk;
      const clientFactory = yield* GooglePlayServerApiClientFactoryOverride;
      const buildClient = (input: GooglePlayServerApiClientFactoryInput) => {
        const overridden = clientFactory?.(input);
        if (overridden !== undefined) return Effect.succeed(overridden);
        return realBuildClient(input);
      };
      return constant({ buildClient });
    }),
  },
) {
  static readonly layer = Layer.effect(GooglePlayServerApi)(GooglePlayServerApi.make);
}

export type GooglePlaySdkContextConfig = {
  readonly packageName: string;
  readonly serviceAccountKey: string;
};

/**
 * Builds the per-tenant Google Play API context. The client construction mints
 * an OAuth2 access token (network I/O), so this is an Effect, not a pure
 * factory.
 */
export const buildGooglePlaySdkContext = (
  api: typeof GooglePlayServerApi.Service,
  config: GooglePlaySdkContextConfig,
) =>
  Effect.gen(function* () {
    const client = yield* api.buildClient({
      packageName: config.packageName,
      serviceAccountKey: config.serviceAccountKey,
    });

    const getSubscriptionV2 = (purchaseToken: string) => client.getSubscriptionV2(purchaseToken);
    const getProductV2 = (purchaseToken: string) => client.getProductV2(purchaseToken);
    const getVoidedPurchases = (options?: {
      startTime?: string;
      endTime?: string;
      maxResults?: number;
      token?: string;
      type?: 0 | 1;
    }) => client.getVoidedPurchases(options);

    /**
     * Resolves the developer-set list price for a subscription base plan in the
     * buyer's region from the monetization catalog. Returns `Option.none()`
     * when the region is unknown, the catalog can't be fetched, or no regional
     * config matches — the caller then omits money (revenue is summed only on
     * the USD amount, so a missing price contributes 0 rather than a guess).
     */
    const resolveSubscriptionRegionalPrice = (input: {
      readonly productId: string;
      readonly basePlanId: Option.Option<string>;
      readonly regionCode: Option.Option<string>;
    }): Effect.Effect<Option.Option<MoneyType>> =>
      Effect.fn("resolveSubscriptionRegionalPrice")(function* () {
        if (Option.isNone(input.regionCode)) {
          return Option.none<MoneyType>();
        }
        const regionCode = input.regionCode.value;
        const subscription = yield* client.getSubscription(input.productId).pipe(
          Effect.map(Option.some),
          // Best-effort: a catalog miss or fetch failure yields no price (money
          // is omitted, never guessed — consistent with the FX-less discipline).
          // Logged so a transient failure that drops revenue is observable
          // rather than silent; the purchase itself is still recorded.
          Effect.catch((error) =>
            Effect.logWarning("Google Play catalog price fetch failed; recording without money", {
              cause: String(error),
              productId: input.productId,
            }).pipe(Effect.as(Option.none())),
          ),
        );
        if (Option.isNone(subscription)) {
          return Option.none<MoneyType>();
        }
        const basePlans = subscription.value.basePlans ?? [];
        const basePlan = Option.match(input.basePlanId, {
          onNone: () => basePlans[0],
          onSome: (id) => basePlans.find((candidate) => candidate.basePlanId === id),
        });
        if (!basePlan) {
          return Option.none<MoneyType>();
        }
        const regionalConfig = (basePlan.regionalConfigs ?? []).find(
          (candidate) => candidate.regionCode === regionCode,
        );
        return Option.fromNullishOr(regionalConfig?.price);
      })();

    return constant({
      getProductV2,
      getSubscriptionV2,
      getVoidedPurchases,
      packageName: config.packageName,
      resolveSubscriptionRegionalPrice,
    });
  });

export type GooglePlaySdkContext = Effect.Success<ReturnType<typeof buildGooglePlaySdkContext>>;

/**
 * How the provider commands name and read payment providers: the kind people
 * name on the command line, the store types as the CLI spells them, the
 * store products a provider sells, and the addresses a store sends its
 * notifications to.
 */
import type {
  PaymentProviderCatalogEntryJsonEncoding,
  PaymentProviderHistoryImport,
  PaymentProviderJsonEncoding,
  PaymentProviderType,
} from "@voidhash/generated-clients";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import { HttpClientError } from "effect/http";

import { ApiClient, readAll } from "../../utils/api-client";
import type { ApiFailure } from "../../utils/error-formatter";
import { type ItemKind, requireItem } from "../input";
import { storeLabel } from "./catalog";

/** The provider types as `provider connect` and `--type` spell them, with their API values. */
export const PROVIDER_TYPES = [
  ["app-store", "app_store"],
  ["google-play", "google_play"],
  ["stripe", "stripe"],
  ["payment-source", "payment_source"],
] as const satisfies ReadonlyArray<readonly [string, PaymentProviderType]>;

const CLI_TYPE: Readonly<Record<PaymentProviderType, string>> = {
  app_store: "app-store",
  google_play: "google-play",
  stripe: "stripe",
  payment_source: "payment-source",
};

/** A provider as a list shows it: "App Store (com.acme.app)", "Paddle (paddle)". */
export const providerLabel = (provider: PaymentProviderJsonEncoding) =>
  provider.key === null ? storeLabel(provider) : `${storeLabel(provider)} (${provider.key})`;

/**
 * Payment providers answer to their id, store (`app-store`), key (bundle id,
 * package name, Stripe account, payment source slug) and name.
 */
export const providerKind: ItemKind<PaymentProviderJsonEncoding> = {
  noun: "payment provider",
  label: providerLabel,
  listCommand: "voidhash-cli provider list",
  createCommand: "voidhash-cli provider connect",
  keys: (provider) => [
    ...(provider.type === "payment_source" ? [] : [CLI_TYPE[provider.type]]),
    ...(provider.key === null ? [] : [provider.key]),
  ],
  names: (provider) => [provider.name, storeLabel(provider)],
};

/** How a provider reads in a command a person types: `app-store`, or a payment source's slug. */
export const providerHandle = (provider: PaymentProviderJsonEncoding) =>
  provider.type === "payment_source" ? (provider.key ?? provider.id) : CLI_TYPE[provider.type];

/** Providers whose purchase history Voidhash can import. */
export const isImportable = (provider: PaymentProviderJsonEncoding) =>
  provider.type === "stripe" || provider.type === "payment_source";

/** Whether `error` is the server failing rather than refusing, as when a store does not answer. */
const isServerFailure = (error: ApiFailure) =>
  !HttpClientError.isHttpClientError(error) && error.response.status >= 500;

/**
 * The store products `provider` sells, read from the store or the payment
 * source's endpoint; none when the store refused the saved credentials or
 * did not answer, which the caller reports.
 */
export const readCatalog = (
  projectId: string,
  provider: PaymentProviderJsonEncoding,
  options: { readonly refresh?: boolean; readonly isUnmapped?: boolean } = {},
) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    return yield* readAll((query) =>
      api.paymentProvidersListCatalog(projectId, provider.id, {
        ...query,
        // Refreshing reads the whole catalog from the store again, so only the first page asks.
        refresh: options.refresh === true && query.cursor === undefined ? "true" : undefined,
        isUnmapped:
          options.isUnmapped === undefined ? undefined : options.isUnmapped ? "true" : "false",
      }),
    ).pipe(
      Effect.map(Option.some<ReadonlyArray<PaymentProviderCatalogEntryJsonEncoding>>),
      Effect.catchIf(isServerFailure, () => Effect.succeedNone),
    );
  });

/** Store products whose imported purchases wait for a mapping, most waiting first. */
export const readWaiting = (projectId: string, provider: PaymentProviderJsonEncoding) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    return yield* readAll((query) =>
      api.paymentProvidersListUnmappedProducts(projectId, provider.id, query),
    );
  });

/** Why a provider's store products could not be read, and what to run. */
export const catalogProblem = (provider: PaymentProviderJsonEncoding) =>
  provider.type === "payment_source"
    ? `Voidhash could not read ${providerLabel(provider)}'s products from its endpoint; 'voidhash-cli provider test ${providerHandle(provider)}' says why.`
    : `Voidhash could not read ${providerLabel(provider)}'s store products: the saved credentials may be wrong or expired${provider.type === "stripe" ? " (a restricted key needs read access to Prices and Products)" : ""}, or the store did not answer. 'voidhash-cli provider test ${providerHandle(provider)}' checks again; 'voidhash-cli provider connect ${providerHandle(provider)}' saves new credentials.`;

/** The address the store sends its notifications to, and where a person sets it. */
export const notificationTarget = (apiUrl: string, provider: PaymentProviderJsonEncoding) => {
  const trimmed = apiUrl.replace(/\/+$/, "");
  const base = `${trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`}/v1/inbound-webhooks`;
  if (provider.type === "app_store") {
    return Option.some({
      url: `${base}/apple-server-to-server/${provider.id}`,
      where: "the App Store Server Notifications URL (version 2) of the app in App Store Connect",
    });
  }
  if (provider.type === "google_play") {
    return Option.some({
      url: `${base}/google-play-rtdn/${provider.id}`,
      where:
        "the push endpoint of the Pub/Sub subscription to the app's real-time developer notifications topic",
    });
  }
  if (provider.type === "stripe") {
    return Option.some({
      url: `${base}/stripe/${provider.id}`,
      where:
        "a webhook endpoint in Stripe, live and test mode, whose signing secrets Voidhash then needs",
    });
  }
  return Option.none();
};

/**
 * The URL of a payment source's endpoint from its stored configuration:
 * `endpoint` serves production requests (and test ones without a test
 * endpoint), `testEndpoint` serves only test requests.
 */
export const endpointUrlOf = (
  provider: PaymentProviderJsonEncoding,
  which: "endpoint" | "testEndpoint",
): Option.Option<string> => {
  const endpoint = provider.configuration[which];
  return P.isObject(endpoint) && P.hasProperty(endpoint, "url") && P.isString(endpoint.url)
    ? Option.some(endpoint.url)
    : Option.none();
};

/**
 * The configuration a mapping of `storeProductKey` takes when the catalog
 * does not list it: a Stripe `prod_…:price_…` pair, a Google Play
 * `productId:basePlanId`, an App Store product id or a payment source key.
 */
export const mappingConfigurationFor = (
  type: PaymentProviderType,
  storeProductKey: string,
): Record<string, unknown> => {
  const [first = storeProductKey, ...rest] = storeProductKey.split(":");
  const second = rest.join(":");
  if (type === "app_store") return { productId: storeProductKey };
  if (type === "payment_source") return { productKey: storeProductKey };
  if (type === "google_play") {
    return second === "" ? { productId: first } : { productId: first, basePlanId: second };
  }
  return { productId: first, priceId: second };
};

/** An import's progress in one line: "running, recording: 300 found, 120 recorded". */
export const describeImport = (historyImport: PaymentProviderHistoryImport) => {
  const { counts } = historyImport;
  const tally = [
    `${counts.total} found`,
    `${counts.applied} recorded`,
    ...(counts.ignored === 0 ? [] : [`${counts.ignored} needed no change`]),
    ...(counts.parked === 0 ? [] : [`${counts.parked} waiting for a store product mapping`]),
    ...(counts.failed === 0 ? [] : [`${counts.failed} failed`]),
  ].join(", ");
  const state =
    historyImport.status === "running"
      ? `running, ${historyImport.phase === "collecting" ? "listing the store's records" : "recording them"}`
      : historyImport.status;
  return `${state}: ${tally}${historyImport.lastError === null ? "" : ` (last error: ${historyImport.lastError})`}`;
};

/** What a stored credential reads as; sending it back keeps the stored one. */
export const STORED_SECRET = "<stored secret>";

/** A new signing secret for one of a payment source's endpoints; shown once, stored encrypted. */
export const newSigningSecret = () =>
  `vhps_${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")}`;

/** The dashboard page of the provider `item` names, for `voidhash-cli open provider <provider>`. */
export const providerPagePath = (projectId: string, item: Option.Option<string>) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const providers = yield* readAll((query) => api.paymentProvidersList(projectId, query));
    const provider = yield* requireItem(
      providerKind,
      providers,
      item,
      "voidhash-cli open provider <provider>",
    );
    return `settings/payment-providers/${provider.id}`;
  });

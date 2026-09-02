import * as Arr from "effect/Array";
import * as R from "effect/Record";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as EffectRuntime from "effect/Effect";
import * as Exit from "effect/Exit";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";
import React from "react";
import { AppState, Linking, Platform } from "react-native";

import type { SdkResolvedPaywall } from "@voidhash/generated-clients";
import type { VoidhashClient } from "../../client";
import type { Product } from "../../core/entities/product";
import type { ProductsBySlug } from "../../core/products/product-service";
import { COMMERCE_FEATURES_ENABLED } from "../../core/constants";
import { VoidhashError } from "../../errors";
import type { PaywallReleaseRuntime } from "../../core/paywalls/paywall-service";
import type { LocationSlug } from "../../core/schema/registry";
import { parsePaywallBridgeEnvelope } from "../../internal/paywall-bridge/parser";
import {
  createPaywallBridgeConfigureMessage,
  createPaywallBridgeErrorResponse,
  createPaywallBridgeSuccessResponse,
  createPaywallBridgeStatusMessage,
} from "../../internal/paywall-bridge/protocol";
import { PaywallPresenter } from "../../nitro";
import type { VoidhashContext } from "../components/provider";
import { toVoidhashInitError } from "../internal/client-lifecycle";

/**
 * Outcome of {@link UsePaywallByLocationResult.show}. Every non-`"shown"`
 * status names a distinct reason the paywall was not presented, so callers can
 * branch on it — retry later, fall back to a native screen, report the error —
 * instead of guessing from a boolean.
 *
 * - `disabled`: the client was created with `enabled: false`, so no paywall
 *   was ever resolved, or paywalls are unavailable in this release. Terminal
 *   — retrying can't change it.
 * - `not_initialized`: the provider is still running `init()` (or the hook is
 *   used outside a `VoidhashProvider`).
 * - `initialization_failed`: the provider's `init()` rejected; `error` is the
 *   provider's `initError`.
 * - `native_unavailable`: the platform has no native paywall presenter.
 * - `not_assigned`: resolution succeeded but no published paywall is assigned
 *   to the location.
 * - `failed`: resolving, preloading or presenting threw, or the native
 *   presenter declined to present.
 */
export type ShowPaywallResult =
  | { status: "shown" }
  | { status: "disabled" }
  | { status: "not_initialized" }
  | { error: Error; status: "initialization_failed" }
  | { status: "native_unavailable" }
  | { status: "not_assigned" }
  | { error: Error; status: "failed" };

export interface UsePaywallByLocationResult {
  show: () => Promise<ShowPaywallResult>;
}

export interface UsePaywallByLocationOptions {
  onError?: (
    error: Error,
    context: {
      action: "purchase" | "restore";
      requestId?: string;
    },
  ) => void;
  /**
   * Called when background preloading of this location's paywall fails. The SDK
   * retries on the next app-foreground and on `show()`, so this is a reporting
   * hook rather than an error the caller has to recover from — a `show()` that
   * hits the same failure returns a `"failed"` {@link ShowPaywallResult}
   * instead of invoking this callback.
   */
  onPreloadError?: (error: Error) => void;
  onPurchase?: (context: { productId: string; requestId?: string }) => void;
  onRestore?: (context: { requestId?: string }) => void;
}

interface ResolvedPaywallEntry {
  htmlUrl: string;
  /** Contract §6 runtime block; absent for visual-editor releases. */
  runtime: Option.Option<PaywallReleaseRuntime>;
}

const resolvedPaywallByLocation = MutableHashMap.empty<string, ResolvedPaywallEntry>();
const activeHookCountByLocation = MutableHashMap.empty<string, number>();
const inFlightActionByLocation = MutableHashSet.empty<string>();

class PaywallBridgeActionError extends Schema.TaggedErrorClass<PaywallBridgeActionError>()(
  "PaywallBridgeActionError",
  { cause: Schema.Unknown },
) {}

export function __internal_resetPaywallByLocationCachesForTests() {
  MutableHashMap.clear(resolvedPaywallByLocation);
  MutableHashMap.clear(activeHookCountByLocation);
  MutableHashSet.clear(inFlightActionByLocation);
}

export function __internal_setResolvedPaywallForTests(
  locationKey: string,
  entry: { htmlUrl: string; runtime: unknown },
) {
  const candidate = Option.isOption(entry.runtime)
    ? entry.runtime
    : Option.fromNullishOr(entry.runtime);
  MutableHashMap.set(resolvedPaywallByLocation, locationKey, {
    htmlUrl: entry.htmlUrl,
    runtime: Option.filter(candidate, isPaywallReleaseRuntime),
  });
}

function isPaywallReleaseRuntime(value: unknown): value is PaywallReleaseRuntime {
  return (
    P.isObject(value) &&
    P.hasProperty(value, "contentHash") &&
    P.isString(value.contentHash) &&
    P.hasProperty(value, "productSlugs") &&
    Arr.isArray(value.productSlugs) &&
    P.hasProperty(value, "variables") &&
    P.isObject(value.variables)
  );
}

function normalizeLocation(locationSlug: string): string {
  return locationSlug;
}

function getResolvedPaywallEntry(
  resolvedPaywall: Option.Option<SdkResolvedPaywall>,
): Option.Option<ResolvedPaywallEntry> {
  if (Option.isNone(resolvedPaywall)) {
    return Option.none();
  }

  const paywallRelease = resolvedPaywall.value.showing.paywallRelease;
  const htmlUrl = paywallRelease?.htmlUrl;
  if (!htmlUrl) {
    return Option.none();
  }

  return Option.some({
    htmlUrl,
    runtime: Option.fromNullishOr(paywallRelease?.runtime),
  });
}

function toPaywallError(value: unknown): Error {
  if (P.isError(value)) return value;
  return new VoidhashError(
    "UNKNOWN",
    P.isObject(value) && "message" in value && P.isString(value.message)
      ? value.message
      : String(value),
    { cause: value },
  );
}

/**
 * Runs a preload that nobody is awaiting (hook mount, app-foreground). Failures
 * are reported and dropped instead of escaping as an unhandled rejection: the
 * SDK retries on the next foreground and on `show()`.
 */
async function runBackgroundPreload(options: {
  locationKey: string;
  onPreloadError?: (error: Error) => void;
  preloadPaywall: () => Promise<Option.Option<Error>>;
}): Promise<void> {
  const error = await options.preloadPaywall();
  if (Option.isNone(error)) {
    return;
  }

  EffectRuntime.runSync(
    Effect.logWarning(
      `[voidhash] failed to preload the paywall for location "${options.locationKey}"`,
      error.value,
    ),
  );
  options.onPreloadError?.(error.value);
}

export async function __internal_runBackgroundPreloadForTests(options: {
  locationKey: string;
  onPreloadError?: (error: Error) => void;
  preloadPaywall: () => Promise<unknown>;
}) {
  await runBackgroundPreload({
    ...options,
    preloadPaywall: async () => {
      const result = await options.preloadPaywall();
      if (Option.isOption(result)) return Option.filter(result, P.isError);
      return result == null ? Option.none() : Option.some(toPaywallError(result));
    },
  });
}

function findProductByBridgeProductId(
  products: ProductsBySlug,
  productId: string,
): Option.Option<Product> {
  const productList = Arr.getSomes(R.values(products));

  const byId = productList.find((product) => product.id === productId);
  if (byId) {
    return Option.some(byId);
  }

  const bySlug = productList.find((product) => product.slug === productId);
  if (bySlug) return Option.some(bySlug);
  return Option.fromUndefinedOr(
    productList.find((product) => product.providerProductId === productId),
  );
}

interface PaywallPresenterBridgeAdapter {
  dismiss: () => Promise<void>;
  postMessage: (locationSlug: string, data: string) => void;
}

function isRuntimeVariable(value: unknown): value is string | number | boolean {
  return P.isString(value) || P.isNumber(value) || P.isBoolean(value);
}

/** `Platform.OS` narrowed to the contract §7.1 platform union. */
function getBridgePlatform(): Option.Option<"ios" | "android"> {
  return Platform.OS === "ios" || Platform.OS === "android"
    ? Option.some(Platform.OS)
    : Option.none();
}

/**
 * Answers the bundle's `ready` event with a `configure` envelope (contract
 * §7.2) when the resolved release is a code release. Visual-editor releases
 * (no `runtime` block) receive nothing. When building the full config fails
 * (e.g. the native store is unavailable) a degraded configure envelope —
 * empty products, the release's variables passed through — is still sent
 * after a warning, so the paywall is never left configless forever.
 */
async function sendConfigureMessage(options: {
  client: VoidhashClient;
  locationKey: string;
  presenter: PaywallPresenterBridgeAdapter;
  requestId?: string;
}) {
  const { client, locationKey, presenter, requestId } = options;

  const runtime = MutableHashMap.get(resolvedPaywallByLocation, locationKey).pipe(
    Option.flatMap((entry) => entry.runtime),
  );
  if (Option.isNone(runtime)) {
    return;
  }

  const runtimeConfigResult = await client.internal.buildPaywallRuntimeConfig(runtime.value);

  if (runtimeConfigResult.isOk()) {
    const postExit = Effect.runSyncExit(
      Effect.try({
        try: () =>
          presenter.postMessage(
            locationKey,
            createPaywallBridgeConfigureMessage(runtimeConfigResult.value, requestId),
          ),
        catch: (error) => error,
      }),
    );
    if (Exit.isSuccess(postExit)) {
      return;
    }
    EffectRuntime.runSync(
      Effect.logWarning(
        "[voidhash] failed to send paywall configure message",
        Cause.squash(postExit.cause),
      ),
    );
  } else {
    EffectRuntime.runSync(
      Effect.logWarning(
        "[voidhash] failed to build the paywall runtime config",
        runtimeConfigResult.error,
      ),
    );
  }

  // Degraded configure envelope — empty products, the release's variables
  // passed through — so the paywall is never left configless forever.
  const fallbackExit = Effect.runSyncExit(
    Effect.try({
      try: () =>
        presenter.postMessage(
          locationKey,
          createPaywallBridgeConfigureMessage(
            {
              products: [],
              variables: R.filter(runtime.value.variables ?? {}, isRuntimeVariable),
              platform: getBridgePlatform().valueOrUndefined,
            },
            requestId,
          ),
        ),
      catch: (fallbackError) => fallbackError,
    }),
  );

  if (!Exit.isSuccess(fallbackExit)) {
    EffectRuntime.runSync(
      Effect.logWarning(
        "[voidhash] failed to send fallback paywall configure message",
        Cause.squash(fallbackExit.cause),
      ),
    );
  }
}

async function handlePaywallBridgeEvent(options: {
  client: VoidhashClient;
  locationKey: string;
  paywallOptions?: UsePaywallByLocationOptions;
  openExternalUrl: (url: string) => Promise<void>;
  presenter: PaywallPresenterBridgeAdapter;
  rawBridgeEvent: string;
}) {
  const { client, locationKey, openExternalUrl, paywallOptions, presenter, rawBridgeEvent } =
    options;

  const bridgeEventExit = EffectRuntime.runSyncExit(parsePaywallBridgeEnvelope(rawBridgeEvent));

  if (!Exit.isSuccess(bridgeEventExit)) {
    EffectRuntime.runSync(
      Effect.logWarning(
        "[voidhash] ignoring unparseable paywall bridge message",
        Cause.squash(bridgeEventExit.cause),
      ),
    );
    return;
  }

  const bridgeEvent = bridgeEventExit.value;

  if (bridgeEvent.type === "ready") {
    await sendConfigureMessage({
      client,
      locationKey,
      presenter,
      requestId: bridgeEvent.requestId,
    });
    return;
  }

  if (bridgeEvent.type === "close") {
    await presenter.dismiss();
    return;
  }

  if (bridgeEvent.type === "openExternal") {
    await openExternalUrl(bridgeEvent.payload.url);
    return;
  }

  if (bridgeEvent.type === "event") {
    // Fire-and-forget analytics (contract §7.2): route to the SDK's capture
    // queue, stamped with the paywall location. No response envelope.
    client.capture(bridgeEvent.payload.name, {
      ...bridgeEvent.payload.properties,
      paywall_location: locationKey,
    });
    return;
  }

  if (bridgeEvent.type !== "purchase" && bridgeEvent.type !== "restore") {
    return;
  }

  if (MutableHashSet.has(inFlightActionByLocation, locationKey)) {
    const busyMessage = "Another paywall action is already running";
    paywallOptions?.onError?.(new VoidhashError("UNKNOWN", busyMessage), {
      action: bridgeEvent.type,
      requestId: bridgeEvent.requestId,
    });
    presenter.postMessage(
      locationKey,
      createPaywallBridgeErrorResponse(
        bridgeEvent.type,
        "ACTION_BUSY",
        busyMessage,
        bridgeEvent.requestId,
      ),
    );
    return;
  }

  /**
   * Runs the purchase/restore action, returning the failure instead of
   * throwing. `null` means the action completed (or was cancelled by the
   * customer) and all envelopes have been posted.
   */
  const runBridgeAction = async (): Promise<Option.Option<VoidhashError>> => {
    if (bridgeEvent.type === "purchase") {
      presenter.postMessage(
        locationKey,
        createPaywallBridgeStatusMessage("purchasing", bridgeEvent.requestId, {
          productId: bridgeEvent.payload.productId,
        }),
      );
      const productsResult = await client.getProducts();
      if (productsResult.isErr()) {
        return Option.some(productsResult.error);
      }
      const product = findProductByBridgeProductId(
        productsResult.value,
        bridgeEvent.payload.productId,
      );

      if (Option.isNone(product)) {
        return Option.some(
          new VoidhashError(
            "FAILED_TO_PURCHASE",
            `Product not found: ${bridgeEvent.payload.productId}`,
          ),
        );
      }

      const result = await client.purchase(product.value);

      if (result.isErr()) {
        return Option.some(result.error);
      }

      if (result.value.status === "cancelled") {
        presenter.postMessage(
          locationKey,
          createPaywallBridgeStatusMessage("cancelled", bridgeEvent.requestId, {
            productId: product.value.id,
          }),
        );
        return Option.none();
      }

      paywallOptions?.onPurchase?.({
        productId: product.value.id,
        requestId: bridgeEvent.requestId,
      });
      presenter.postMessage(
        locationKey,
        createPaywallBridgeStatusMessage("purchased", bridgeEvent.requestId, {
          productId: product.value.id,
        }),
      );
      presenter.postMessage(
        locationKey,
        createPaywallBridgeSuccessResponse("purchase", bridgeEvent.requestId, {
          productId: product.value.id,
        }),
      );
      await presenter.dismiss();
      return Option.none();
    }

    presenter.postMessage(
      locationKey,
      createPaywallBridgeStatusMessage("restoring", bridgeEvent.requestId),
    );
    const restoreResult = await client.restorePurchases();
    if (restoreResult.isErr()) {
      return Option.some(restoreResult.error);
    }
    paywallOptions?.onRestore?.({
      requestId: bridgeEvent.requestId,
    });
    presenter.postMessage(
      locationKey,
      createPaywallBridgeStatusMessage("restored", bridgeEvent.requestId),
    );
    presenter.postMessage(
      locationKey,
      createPaywallBridgeSuccessResponse("restore", bridgeEvent.requestId),
    );
    await presenter.dismiss();
    return Option.none();
  };

  const postActionFailure = (actionError: VoidhashError | Error) => {
    presenter.postMessage(
      locationKey,
      createPaywallBridgeStatusMessage("failed", bridgeEvent.requestId, {
        error: actionError.message,
      }),
    );
    paywallOptions?.onError?.(actionError, {
      action: bridgeEvent.type,
      requestId: bridgeEvent.requestId,
    });
    presenter.postMessage(
      locationKey,
      createPaywallBridgeErrorResponse(
        bridgeEvent.type,
        "ACTION_FAILED",
        actionError.message,
        bridgeEvent.requestId,
      ),
    );
  };

  MutableHashSet.add(inFlightActionByLocation, locationKey);
  await EffectRuntime.runPromise(
    Effect.tryPromise({
      try: () => runBridgeAction(),
      catch: (cause) => new PaywallBridgeActionError({ cause }),
    }).pipe(
      Effect.tap((actionError) =>
        Option.match(actionError, {
          onNone: () => Effect.void,
          onSome: (error) => Effect.sync(() => postActionFailure(error)),
        }),
      ),
      Effect.catchTag("PaywallBridgeActionError", (error) =>
        Effect.sync(() => postActionFailure(toPaywallError(error.cause))),
      ),
      Effect.ensuring(
        Effect.sync(() => MutableHashSet.remove(inFlightActionByLocation, locationKey)),
      ),
    ),
  );
}

export async function __internal_handlePaywallBridgeEventForTests(options: {
  client: VoidhashClient;
  locationKey: string;
  paywallOptions?: UsePaywallByLocationOptions;
  openExternalUrl: (url: string) => Promise<void>;
  presenter: PaywallPresenterBridgeAdapter;
  rawBridgeEvent: string;
}) {
  await handlePaywallBridgeEvent(options);
}

interface PaywallPresenterShowAdapter extends PaywallPresenterBridgeAdapter {
  show: (
    locationSlug: string,
    htmlUrl: string,
    onBridgeEvent?: (rawEvent: string) => void,
    onDismiss?: () => void,
  ) => Promise<boolean>;
}

/**
 * Presents the resolved paywall and, on success, unconditionally re-sends the
 * `configure` envelope. The bundle announces `ready` exactly once at mount,
 * and the native presenters only deliver bridge events to the callback
 * registered by `show` — so a `ready` fired during `preload` is silently
 * dropped and the ready-triggered configure in {@link handlePaywallBridgeEvent}
 * never runs. The post-show send covers that warm path (the runtime applies
 * `configure` idempotently; visual-editor releases no-op via the
 * `runtime == null` guard in {@link sendConfigureMessage}), while the
 * ready-triggered send still covers cold shows where the page finishes
 * loading after the callback is attached.
 */
async function showResolvedPaywall(options: {
  client: VoidhashClient;
  htmlUrl: string;
  locationKey: string;
  onBridgeEvent: (rawBridgeEvent: string) => void;
  presenter: PaywallPresenterShowAdapter;
}): Promise<boolean> {
  const { client, htmlUrl, locationKey, onBridgeEvent, presenter } = options;

  const shown = await presenter.show(locationKey, htmlUrl, onBridgeEvent, () => {
    MutableHashSet.remove(inFlightActionByLocation, locationKey);
  });

  if (shown) {
    void sendConfigureMessage({
      client,
      locationKey,
      presenter,
    });
  }

  return shown;
}

export async function __internal_showResolvedPaywallForTests(options: {
  client: VoidhashClient;
  htmlUrl: string;
  locationKey: string;
  onBridgeEvent: (rawBridgeEvent: string) => void;
  presenter: PaywallPresenterShowAdapter;
}) {
  return await showResolvedPaywall(options);
}

interface ShowPaywallForLocationOptions {
  client: VoidhashClient;
  locationKey: string;
  onBridgeEvent: (rawBridgeEvent: string) => void;
  preloadPaywall: () => Promise<Option.Option<Error>>;
  presenter: Option.Option<PaywallPresenterShowAdapter>;
  voidhashContext: Option.Option<VoidhashContext>;
}

/**
 * Resolves the {@link ShowPaywallResult} for one `show()` call: gates on the
 * provider's init status and on native presenter availability, preloads on
 * demand, then presents. Never rejects — every failure mode is a status.
 */
async function showPaywallForLocation(
  options: ShowPaywallForLocationOptions,
  commerceFeaturesEnabled = COMMERCE_FEATURES_ENABLED,
): Promise<ShowPaywallResult> {
  const { client, locationKey, onBridgeEvent, preloadPaywall, presenter, voidhashContext } =
    options;

  if (
    !commerceFeaturesEnabled ||
    (Option.isSome(voidhashContext) && voidhashContext.value.status === "disabled")
  ) {
    return { status: "disabled" };
  }

  if (Option.isNone(voidhashContext) || voidhashContext.value.status === "initializing") {
    return { status: "not_initialized" };
  }

  if (voidhashContext.value.status === "failed") {
    return {
      error: Option.getOrElse(voidhashContext.value.initError, () =>
        toVoidhashInitError("Voidhash client failed to initialize"),
      ),
      status: "initialization_failed",
    };
  }

  if (Option.isNone(presenter)) {
    return { status: "native_unavailable" };
  }

  if (Option.isNone(MutableHashMap.get(resolvedPaywallByLocation, locationKey))) {
    const preloadError = await preloadPaywall();
    if (Option.isSome(preloadError)) {
      return { error: preloadError.value, status: "failed" };
    }
  }

  const resolvedEntry = MutableHashMap.get(resolvedPaywallByLocation, locationKey);
  if (Option.isNone(resolvedEntry)) {
    return { status: "not_assigned" };
  }

  const showExit = await Effect.runPromiseExit(
    Effect.tryPromise({
      try: () =>
        showResolvedPaywall({
          client,
          htmlUrl: resolvedEntry.value.htmlUrl,
          locationKey,
          onBridgeEvent,
          presenter: presenter.value,
        }),
      catch: (error) => error,
    }),
  );

  if (!Exit.isSuccess(showExit)) {
    return { error: toPaywallError(Cause.squash(showExit.cause)), status: "failed" };
  }

  if (!showExit.value) {
    return {
      error: new VoidhashError(
        "UNKNOWN",
        `Native paywall presentation was declined for location "${locationKey}"`,
      ),
      status: "failed",
    };
  }

  return { status: "shown" };
}

export async function __internal_showPaywallForLocationForTests(
  options: {
    client: VoidhashClient;
    locationKey: string;
    onBridgeEvent: (rawBridgeEvent: string) => void;
    preloadPaywall: () => Promise<unknown>;
    presenter: unknown;
    voidhashContext: unknown;
  },
  commerceFeaturesEnabled = true,
) {
  return await showPaywallForLocation(
    {
      ...options,
      preloadPaywall: async () => {
        const result = await options.preloadPaywall();
        if (Option.isOption(result)) return Option.filter(result, P.isError);
        return result == null ? Option.none() : Option.some(toPaywallError(result));
      },
      presenter: Option.filter(Option.fromNullishOr(options.presenter), isPaywallPresenter),
      voidhashContext: Option.filter(
        Option.fromNullishOr(options.voidhashContext),
        isVoidhashContext,
      ).pipe(
        Option.map((context) => ({
          ...context,
          initError: Option.isOption(context.initError)
            ? context.initError
            : Option.fromNullishOr(context.initError),
        })),
      ),
    },
    commerceFeaturesEnabled,
  );
}

function isPaywallPresenter(value: unknown): value is PaywallPresenterShowAdapter {
  return (
    P.isObject(value) &&
    P.hasProperty(value, "dismiss") &&
    P.isFunction(value.dismiss) &&
    P.hasProperty(value, "postMessage") &&
    P.isFunction(value.postMessage) &&
    P.hasProperty(value, "show") &&
    P.isFunction(value.show)
  );
}

function isVoidhashContext(value: unknown): value is VoidhashContext {
  return P.isObject(value) && P.hasProperty(value, "status") && P.isString(value.status);
}

function incrementActiveHookCount(locationSlug: string) {
  const existingCount = Option.getOrElse(
    MutableHashMap.get(activeHookCountByLocation, locationSlug),
    () => 0,
  );
  MutableHashMap.set(activeHookCountByLocation, locationSlug, existingCount + 1);
}

function decrementActiveHookCount(locationSlug: string) {
  const existingCount = Option.getOrElse(
    MutableHashMap.get(activeHookCountByLocation, locationSlug),
    () => 0,
  );
  if (existingCount <= 1) {
    MutableHashMap.remove(activeHookCountByLocation, locationSlug);
    return 0;
  }

  const nextCount = existingCount - 1;
  MutableHashMap.set(activeHookCountByLocation, locationSlug, nextCount);
  return nextCount;
}

export function paywallByLocationHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<Option.Option<VoidhashContext>>,
) {
  function usePaywallByLocation(
    locationSlug: LocationSlug,
    paywallOptions?: UsePaywallByLocationOptions,
  ): UsePaywallByLocationResult {
    const voidhashContext = React.useContext(vhContext);
    const locationKey = normalizeLocation(String(locationSlug));
    const isReady =
      COMMERCE_FEATURES_ENABLED &&
      Option.isSome(voidhashContext) &&
      voidhashContext.value.status === "ready";

    // `paywallOptions` is typically a fresh object literal on every render, so
    // the preload effect reads the callback through a ref instead of taking a
    // dependency that would re-run (and re-preload) on every render.
    const onPreloadError = paywallOptions?.onPreloadError;
    const onPreloadErrorRef = React.useRef(onPreloadError);
    React.useEffect(() => {
      onPreloadErrorRef.current = onPreloadError;
    }, [onPreloadError]);

    /** Returns the preload failure instead of throwing, so callers decide how to report it. */
    const preloadPaywall = React.useCallback(async (): Promise<Option.Option<Error>> => {
      const presenter = PaywallPresenter;
      if (!(isReady && presenter)) {
        return Option.none();
      }

      const resolvedPaywallResult = await client.getPaywallForLocation(locationSlug);
      if (resolvedPaywallResult.isErr()) {
        return Option.some(resolvedPaywallResult.error);
      }
      const resolvedEntry = getResolvedPaywallEntry(
        Option.fromNullishOr(resolvedPaywallResult.value),
      );

      if (Option.isNone(resolvedEntry)) {
        MutableHashMap.remove(resolvedPaywallByLocation, locationKey);
        return Option.none();
      }

      MutableHashMap.set(resolvedPaywallByLocation, locationKey, resolvedEntry.value);
      const preloadExit = await Effect.runPromiseExit(
        Effect.tryPromise({
          try: () => presenter.preload(locationKey, resolvedEntry.value.htmlUrl),
          catch: (error) => error,
        }),
      );
      if (Exit.isSuccess(preloadExit)) {
        return Option.none();
      }
      return Option.some(toPaywallError(Cause.squash(preloadExit.cause)));
    }, [client, isReady, locationKey, locationSlug]);

    const preloadInBackground = React.useCallback(() => {
      void runBackgroundPreload({
        locationKey,
        onPreloadError: (error: Error) => onPreloadErrorRef.current?.(error),
        preloadPaywall,
      });
    }, [locationKey, preloadPaywall]);

    const handleBridgeEvent = React.useCallback(
      async (rawBridgeEvent: string) => {
        if (!PaywallPresenter) {
          return;
        }

        await handlePaywallBridgeEvent({
          client,
          locationKey,
          paywallOptions,
          openExternalUrl: (url: string) => Linking.openURL(url),
          presenter: PaywallPresenter,
          rawBridgeEvent,
        });
      },
      [client, locationKey, paywallOptions],
    );

    const show = React.useCallback(
      async () =>
        await showPaywallForLocation({
          client,
          locationKey,
          onBridgeEvent: (rawBridgeEvent: string) => {
            void handleBridgeEvent(rawBridgeEvent);
          },
          preloadPaywall,
          presenter: Option.fromNullishOr(PaywallPresenter),
          voidhashContext,
        }),
      [handleBridgeEvent, locationKey, preloadPaywall, voidhashContext],
    );

    React.useEffect(() => {
      incrementActiveHookCount(locationKey);

      return () => {
        const nextCount = decrementActiveHookCount(locationKey);
        if (nextCount === 0 && PaywallPresenter) {
          MutableHashSet.remove(inFlightActionByLocation, locationKey);
          PaywallPresenter.release(locationKey);
        }
      };
    }, [locationKey]);

    React.useEffect(() => {
      if (!isReady) {
        return;
      }

      preloadInBackground();

      const appStateSubscription = AppState.addEventListener("change", (nextState) => {
        if (nextState === "active") {
          preloadInBackground();
        }
      });

      return () => {
        appStateSubscription.remove();
      };
    }, [isReady, preloadInBackground]);

    return {
      show,
    };
  }

  return usePaywallByLocation;
}

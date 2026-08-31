import { Cause, Effect, Exit } from "effect";
import React, { useCallback, useEffect } from "react";
import { AppState, Linking, Platform } from "react-native";

import type { SdkResolvedPaywall } from "@voidhash/generated-clients";
import type { VoidhashClient } from "../../client";
import type { Product } from "../../core/entities/product";
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
  /** Contract §6 runtime block; `null` for visual-editor releases. */
  runtime: PaywallReleaseRuntime | null;
}

const resolvedPaywallByLocation = new Map<string, ResolvedPaywallEntry>();
const activeHookCountByLocation = new Map<string, number>();
const inFlightActionByLocation = new Set<string>();

export function __internal_resetPaywallByLocationCachesForTests() {
  resolvedPaywallByLocation.clear();
  activeHookCountByLocation.clear();
  inFlightActionByLocation.clear();
}

export function __internal_setResolvedPaywallForTests(
  locationKey: string,
  entry: ResolvedPaywallEntry,
) {
  resolvedPaywallByLocation.set(locationKey, entry);
}

function normalizeLocation(locationSlug: string): string {
  return locationSlug;
}

function getResolvedPaywallEntry(
  resolvedPaywall: SdkResolvedPaywall | null | undefined,
): ResolvedPaywallEntry | null {
  if (!resolvedPaywall) {
    return null;
  }

  const paywallRelease = resolvedPaywall.showing.paywallRelease;
  const htmlUrl = paywallRelease?.htmlUrl;
  if (!htmlUrl || htmlUrl.length === 0) {
    return null;
  }

  return {
    htmlUrl,
    runtime: paywallRelease?.runtime ?? null,
  };
}

function toPaywallError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Runs a preload that nobody is awaiting (hook mount, app-foreground). Failures
 * are reported and dropped instead of escaping as an unhandled rejection: the
 * SDK retries on the next foreground and on `show()`.
 */
async function runBackgroundPreload(options: {
  locationKey: string;
  onPreloadError?: (error: Error) => void;
  preloadPaywall: () => Promise<Error | null>;
}): Promise<void> {
  const error = await options.preloadPaywall();
  if (!error) {
    return;
  }

  // This warning is intentionally surfaced in all environments.
  console.warn(
    `[voidhash] failed to preload the paywall for location "${options.locationKey}"`,
    error,
  );
  options.onPreloadError?.(error);
}

export async function __internal_runBackgroundPreloadForTests(options: {
  locationKey: string;
  onPreloadError?: (error: Error) => void;
  preloadPaywall: () => Promise<Error | null>;
}) {
  await runBackgroundPreload(options);
}

function findProductByBridgeProductId(
  products: Record<string, Product | null>,
  productId: string,
): Product | null {
  const productList = Object.values(products).filter(
    (product): product is Product => product !== null,
  );

  const byId = productList.find((product) => product.id === productId);
  if (byId) {
    return byId;
  }

  const bySlug = productList.find((product) => product.slug === productId);
  if (bySlug) return bySlug;
  return productList.find((product) => product.providerProductId === productId) ?? null;
}

interface PaywallPresenterBridgeAdapter {
  dismiss: () => Promise<void>;
  postMessage: (locationSlug: string, data: string) => void;
}

/** `Platform.OS` narrowed to the contract §7.1 platform union. */
function getBridgePlatform(): "ios" | "android" | undefined {
  return Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined;
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

  const runtime = resolvedPaywallByLocation.get(locationKey)?.runtime;
  if (!runtime) {
    return;
  }

  const runtimeConfigResult = await client.internal.buildPaywallRuntimeConfig(runtime);

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
    // This warning is intentionally surfaced in all environments.
    console.warn(
      "[voidhash] failed to send paywall configure message",
      Cause.squash(postExit.cause),
    );
  } else {
    // This warning is intentionally surfaced in all environments.
    console.warn(
      "[voidhash] failed to build the paywall runtime config",
      runtimeConfigResult.error,
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
              variables: (runtime.variables ?? {}) as Parameters<
                typeof createPaywallBridgeConfigureMessage
              >[0]["variables"],
              platform: getBridgePlatform(),
            },
            requestId,
          ),
        ),
      catch: (fallbackError) => fallbackError,
    }),
  );

  if (!Exit.isSuccess(fallbackExit)) {
    // This warning is intentionally surfaced in all environments.
    console.warn(
      "[voidhash] failed to send fallback paywall configure message",
      Cause.squash(fallbackExit.cause),
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

  const bridgeEventExit = Effect.runSyncExit(
    Effect.try({
      try: () => parsePaywallBridgeEnvelope(rawBridgeEvent),
      catch: (error) => error,
    }),
  );

  if (!Exit.isSuccess(bridgeEventExit)) {
    // This warning is intentionally surfaced in all environments.
    console.warn(
      "[voidhash] ignoring unparseable paywall bridge message",
      Cause.squash(bridgeEventExit.cause),
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

  if (inFlightActionByLocation.has(locationKey)) {
    const busyMessage = "Another paywall action is already running";
    paywallOptions?.onError?.(new Error(busyMessage), {
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
  const runBridgeAction = async (): Promise<VoidhashError | null> => {
    if (bridgeEvent.type === "purchase") {
      presenter.postMessage(
        locationKey,
        createPaywallBridgeStatusMessage("purchasing", bridgeEvent.requestId, {
          productId: bridgeEvent.payload.productId,
        }),
      );
      const productsResult = await client.getProducts();
      if (productsResult.isErr()) {
        return productsResult.error;
      }
      const product = findProductByBridgeProductId(
        productsResult.value,
        bridgeEvent.payload.productId,
      );

      if (!product) {
        return new VoidhashError(
          "FAILED_TO_PURCHASE",
          `Product not found: ${bridgeEvent.payload.productId}`,
        );
      }

      const result = await client.purchase(product);

      if (result.isErr()) {
        return result.error;
      }

      if (result.value.status === "cancelled") {
        presenter.postMessage(
          locationKey,
          createPaywallBridgeStatusMessage("cancelled", bridgeEvent.requestId, {
            productId: product.id,
          }),
        );
        return null;
      }

      paywallOptions?.onPurchase?.({
        productId: product.id,
        requestId: bridgeEvent.requestId,
      });
      presenter.postMessage(
        locationKey,
        createPaywallBridgeStatusMessage("purchased", bridgeEvent.requestId, {
          productId: product.id,
        }),
      );
      presenter.postMessage(
        locationKey,
        createPaywallBridgeSuccessResponse("purchase", bridgeEvent.requestId, {
          productId: product.id,
        }),
      );
      await presenter.dismiss();
      return null;
    }

    presenter.postMessage(
      locationKey,
      createPaywallBridgeStatusMessage("restoring", bridgeEvent.requestId),
    );
    const restoreResult = await client.restorePurchases();
    if (restoreResult.isErr()) {
      return restoreResult.error;
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
    return null;
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

  inFlightActionByLocation.add(locationKey);
  await Effect.runPromise(
    Effect.tryPromise({ try: () => runBridgeAction(), catch: (error) => error }).pipe(
      Effect.flatMap((actionError) =>
        actionError === null
          ? Effect.void
          : Effect.sync(() => {
              postActionFailure(actionError);
            }),
      ),
      Effect.catch((unexpectedError) =>
        Effect.sync(() => {
          postActionFailure(toPaywallError(unexpectedError));
        }),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          inFlightActionByLocation.delete(locationKey);
        }),
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
    inFlightActionByLocation.delete(locationKey);
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
  preloadPaywall: () => Promise<Error | null>;
  presenter: PaywallPresenterShowAdapter | null | undefined;
  voidhashContext: VoidhashContext | null;
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

  if (!commerceFeaturesEnabled || voidhashContext?.status === "disabled") {
    return { status: "disabled" };
  }

  if (!voidhashContext || voidhashContext.status === "initializing") {
    return { status: "not_initialized" };
  }

  if (voidhashContext.status === "failed") {
    return {
      error: voidhashContext.initError ?? new Error("Voidhash client failed to initialize"),
      status: "initialization_failed",
    };
  }

  if (!presenter) {
    return { status: "native_unavailable" };
  }

  if (!resolvedPaywallByLocation.has(locationKey)) {
    const preloadError = await preloadPaywall();
    if (preloadError) {
      return { error: preloadError, status: "failed" };
    }
  }

  const resolvedEntry = resolvedPaywallByLocation.get(locationKey);
  if (!resolvedEntry) {
    return { status: "not_assigned" };
  }

  const showExit = await Effect.runPromiseExit(
    Effect.tryPromise({
      try: () =>
        showResolvedPaywall({
          client,
          htmlUrl: resolvedEntry.htmlUrl,
          locationKey,
          onBridgeEvent,
          presenter,
        }),
      catch: (error) => error,
    }),
  );

  if (!Exit.isSuccess(showExit)) {
    return { error: toPaywallError(Cause.squash(showExit.cause)), status: "failed" };
  }

  if (!showExit.value) {
    return {
      error: new Error(`Native paywall presentation was declined for location "${locationKey}"`),
      status: "failed",
    };
  }

  return { status: "shown" };
}

export async function __internal_showPaywallForLocationForTests(
  options: ShowPaywallForLocationOptions,
  commerceFeaturesEnabled = true,
) {
  return await showPaywallForLocation(options, commerceFeaturesEnabled);
}

function incrementActiveHookCount(locationSlug: string) {
  const existingCount = activeHookCountByLocation.get(locationSlug) ?? 0;
  activeHookCountByLocation.set(locationSlug, existingCount + 1);
}

function decrementActiveHookCount(locationSlug: string) {
  const existingCount = activeHookCountByLocation.get(locationSlug) ?? 0;
  if (existingCount <= 1) {
    activeHookCountByLocation.delete(locationSlug);
    return 0;
  }

  const nextCount = existingCount - 1;
  activeHookCountByLocation.set(locationSlug, nextCount);
  return nextCount;
}

export function paywallByLocationHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<VoidhashContext | null>,
) {
  function usePaywallByLocation(
    locationSlug: LocationSlug,
    paywallOptions?: UsePaywallByLocationOptions,
  ): UsePaywallByLocationResult {
    const voidhashContext = React.useContext(vhContext);
    const locationKey = normalizeLocation(String(locationSlug));
    const isReady = COMMERCE_FEATURES_ENABLED && voidhashContext?.status === "ready";

    // `paywallOptions` is typically a fresh object literal on every render, so
    // the preload effect reads the callback through a ref instead of taking a
    // dependency that would re-run (and re-preload) on every render.
    const onPreloadError = paywallOptions?.onPreloadError;
    const onPreloadErrorRef = React.useRef(onPreloadError);
    useEffect(() => {
      onPreloadErrorRef.current = onPreloadError;
    }, [onPreloadError]);

    /** Returns the preload failure instead of throwing, so callers decide how to report it. */
    const preloadPaywall = useCallback(async (): Promise<Error | null> => {
      const presenter = PaywallPresenter;
      if (!(isReady && presenter)) {
        return null;
      }

      const resolvedPaywallResult = await client.getPaywallForLocation(locationSlug);
      if (resolvedPaywallResult.isErr()) {
        return resolvedPaywallResult.error;
      }
      const resolvedEntry = getResolvedPaywallEntry(resolvedPaywallResult.value);

      if (!resolvedEntry) {
        resolvedPaywallByLocation.delete(locationKey);
        return null;
      }

      resolvedPaywallByLocation.set(locationKey, resolvedEntry);
      const preloadExit = await Effect.runPromiseExit(
        Effect.tryPromise({
          try: () => presenter.preload(locationKey, resolvedEntry.htmlUrl),
          catch: (error) => error,
        }),
      );
      if (Exit.isSuccess(preloadExit)) {
        return null;
      }
      return toPaywallError(Cause.squash(preloadExit.cause));
    }, [client, isReady, locationKey, locationSlug]);

    const preloadInBackground = useCallback(() => {
      void runBackgroundPreload({
        locationKey,
        onPreloadError: (error: Error) => onPreloadErrorRef.current?.(error),
        preloadPaywall,
      });
    }, [locationKey, preloadPaywall]);

    const handleBridgeEvent = useCallback(
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

    const show = useCallback(
      async () =>
        await showPaywallForLocation({
          client,
          locationKey,
          onBridgeEvent: (rawBridgeEvent: string) => {
            void handleBridgeEvent(rawBridgeEvent);
          },
          preloadPaywall,
          presenter: PaywallPresenter,
          voidhashContext,
        }),
      [handleBridgeEvent, locationKey, preloadPaywall, voidhashContext],
    );

    useEffect(() => {
      incrementActiveHookCount(locationKey);

      return () => {
        const nextCount = decrementActiveHookCount(locationKey);
        if (nextCount === 0 && PaywallPresenter) {
          inFlightActionByLocation.delete(locationKey);
          PaywallPresenter.release(locationKey);
        }
      };
    }, [locationKey]);

    useEffect(() => {
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

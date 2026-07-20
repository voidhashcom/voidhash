import React, { useCallback, useEffect } from "react";
import { AppState, Linking, Platform } from "react-native";

import type { VoidhashClient } from "../../client";
import type { Product } from "../../core/entities/product";
import type { PaywallReleaseRuntime } from "../../core/paywalls/paywall-service";
import type { LocationSlug } from "../../core/schema/registry";
import { parsePaywallBridgeEnvelope } from "../../internal/paywall-bridge/parser";
import {
  createPaywallBridgeConfigureMessage,
  createPaywallBridgeErrorResponse,
  createPaywallBridgeSuccessResponse,
} from "../../internal/paywall-bridge/protocol";
import { PaywallPresenter } from "../../nitro";
import type { VoidhashContext } from "../components/provider";

export interface UsePaywallByLocationResult {
  show: () => Promise<boolean>;
}

export interface UsePaywallByLocationOptions {
  onError?: (
    error: Error,
    context: {
      action: "purchase" | "restore";
      requestId?: string;
    },
  ) => void;
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
  resolvedPaywall: Awaited<ReturnType<VoidhashClient["getPaywallForLocation"]>> | null | undefined,
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

function getErrorPayload(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    return {
      code: "ACTION_FAILED",
      message: error.message,
    };
  }

  return {
    code: "ACTION_FAILED",
    message: "Unknown paywall bridge action error",
  };
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
  return bySlug ?? null;
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

  try {
    const runtimeConfig = await client.internal_buildPaywallRuntimeConfig(runtime);
    presenter.postMessage(
      locationKey,
      createPaywallBridgeConfigureMessage(runtimeConfig, requestId),
    );
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: This warning is intentionally surfaced in all environments.
    console.warn("[voidhash] failed to send paywall configure message", error);

    try {
      presenter.postMessage(
        locationKey,
        createPaywallBridgeConfigureMessage(
          {
            products: [],
            variables: Object.fromEntries(
              Object.entries(runtime.variables ?? {}).filter(
                (entry): entry is [string, string | number | boolean] =>
                  typeof entry[1] === "string" ||
                  typeof entry[1] === "number" ||
                  typeof entry[1] === "boolean",
              ),
            ),
            platform: getBridgePlatform(),
          },
          requestId,
        ),
      );
    } catch (fallbackError) {
      // biome-ignore lint/suspicious/noConsole: This warning is intentionally surfaced in all environments.
      console.warn("[voidhash] failed to send fallback paywall configure message", fallbackError);
    }
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

  let bridgeEvent: ReturnType<typeof parsePaywallBridgeEnvelope>;
  try {
    bridgeEvent = parsePaywallBridgeEnvelope(rawBridgeEvent);
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: This warning is intentionally surfaced in all environments.
    console.warn("[voidhash] ignoring unparseable paywall bridge message", error);
    return;
  }

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
      ...(bridgeEvent.payload.properties ?? {}),
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

  inFlightActionByLocation.add(locationKey);
  try {
    if (bridgeEvent.type === "purchase") {
      const products = await client.getProducts();
      const product = findProductByBridgeProductId(products, bridgeEvent.payload.productId);

      if (!product) {
        const productNotFoundMessage = `Product not found: ${bridgeEvent.payload.productId}`;
        paywallOptions?.onError?.(new Error(productNotFoundMessage), {
          action: "purchase",
          requestId: bridgeEvent.requestId,
        });
        presenter.postMessage(
          locationKey,
          createPaywallBridgeErrorResponse(
            "purchase",
            "ACTION_FAILED",
            productNotFoundMessage,
            bridgeEvent.requestId,
          ),
        );
        return;
      }

      await client.purchase(product, {
        method: "native",
      });

      paywallOptions?.onPurchase?.({
        productId: product.id,
        requestId: bridgeEvent.requestId,
      });
      presenter.postMessage(
        locationKey,
        createPaywallBridgeSuccessResponse("purchase", bridgeEvent.requestId, {
          productId: product.id,
        }),
      );
      await presenter.dismiss();
      return;
    }

    await client.restorePurchases();
    paywallOptions?.onRestore?.({
      requestId: bridgeEvent.requestId,
    });
    presenter.postMessage(
      locationKey,
      createPaywallBridgeSuccessResponse("restore", bridgeEvent.requestId),
    );
    await presenter.dismiss();
  } catch (error) {
    const errorPayload = getErrorPayload(error);
    paywallOptions?.onError?.(new Error(errorPayload.message), {
      action: bridgeEvent.type,
      requestId: bridgeEvent.requestId,
    });
    presenter.postMessage(
      locationKey,
      createPaywallBridgeErrorResponse(
        bridgeEvent.type,
        errorPayload.code,
        errorPayload.message,
        bridgeEvent.requestId,
      ),
    );
  } finally {
    inFlightActionByLocation.delete(locationKey);
  }
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

    const preloadPaywall = useCallback(async () => {
      if (!(voidhashContext?.isInitialized && PaywallPresenter)) {
        return;
      }

      const resolvedPaywall = await client.getPaywallForLocation(locationSlug);
      const resolvedEntry = getResolvedPaywallEntry(resolvedPaywall);

      if (!resolvedEntry) {
        resolvedPaywallByLocation.delete(locationKey);
        return;
      }

      resolvedPaywallByLocation.set(locationKey, resolvedEntry);
      await PaywallPresenter.preload(locationKey, resolvedEntry.htmlUrl);
    }, [client, locationKey, locationSlug, voidhashContext?.isInitialized]);

    const handleBridgeEvent = useCallback(
      async (rawBridgeEvent: string) => {
        if (!PaywallPresenter) {
          return;
        }

        await handlePaywallBridgeEvent({
          client,
          locationKey,
          paywallOptions,
          openExternalUrl: Linking.openURL,
          presenter: PaywallPresenter,
          rawBridgeEvent,
        });
      },
      [client, locationKey, paywallOptions],
    );

    const show = useCallback(async () => {
      if (!(voidhashContext?.isInitialized && PaywallPresenter)) {
        return false;
      }

      if (!resolvedPaywallByLocation.has(locationKey)) {
        await preloadPaywall();
      }

      const resolvedEntry = resolvedPaywallByLocation.get(locationKey);
      if (!resolvedEntry) {
        return false;
      }

      return await showResolvedPaywall({
        client,
        htmlUrl: resolvedEntry.htmlUrl,
        locationKey,
        onBridgeEvent: (rawBridgeEvent: string) => {
          void handleBridgeEvent(rawBridgeEvent);
        },
        presenter: PaywallPresenter,
      });
    }, [client, handleBridgeEvent, locationKey, preloadPaywall, voidhashContext?.isInitialized]);

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
      if (!voidhashContext?.isInitialized) {
        return;
      }

      void preloadPaywall();

      const appStateSubscription = AppState.addEventListener("change", (nextState) => {
        if (nextState === "active") {
          void preloadPaywall();
        }
      });

      return () => {
        appStateSubscription.remove();
      };
    }, [preloadPaywall, voidhashContext?.isInitialized]);

    return {
      show,
    };
  }

  return usePaywallByLocation;
}

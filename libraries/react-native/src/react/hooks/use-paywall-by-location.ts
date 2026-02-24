import React, { useCallback, useEffect } from "react";
import { AppState, Linking } from "react-native";

import type { VoidhashClient } from "../../client";
import type {
  ExtractSchemaPaywallLocationSlugs,
  InferGetProductResponseFromSchema,
  VoidhashSchema,
} from "../../core/schema";
import { PaywallPresenter } from "../../nitro";
import {
  createPaywallBridgeErrorResponse,
  createPaywallBridgeSuccessResponse,
} from "../../internal/paywall-bridge/protocol";
import { parsePaywallBridgeEnvelope } from "../../internal/paywall-bridge/parser";
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
    }
  ) => void;
  onPurchase?: (context: { productId: string; requestId?: string }) => void;
  onRestore?: (context: { requestId?: string }) => void;
}

type InferGetPaywallLocationInput<TSchema extends VoidhashSchema> =
  [ExtractSchemaPaywallLocationSlugs<TSchema>] extends [never]
    ? string
    : ExtractSchemaPaywallLocationSlugs<TSchema>;

type ResolvedProduct<TSchema extends VoidhashSchema> = Exclude<
  InferGetProductResponseFromSchema<TSchema>[keyof InferGetProductResponseFromSchema<TSchema>],
  null
>;

const resolvedPaywallHtmlByLocation = new Map<string, string>();
const activeHookCountByLocation = new Map<string, number>();
const inFlightActionByLocation = new Set<string>();

export function __internal_resetPaywallByLocationCachesForTests() {
  resolvedPaywallHtmlByLocation.clear();
  activeHookCountByLocation.clear();
  inFlightActionByLocation.clear();
}

function normalizeLocation(locationSlug: string): string {
  return locationSlug;
}

function getResolvedHtmlUrl(
  resolvedPaywall:
    | Awaited<ReturnType<VoidhashClient<VoidhashSchema>["getPaywallForLocation"]>>
    | null
    | undefined
): string | null {
  if (!resolvedPaywall) {
    return null;
  }

  const htmlUrl = resolvedPaywall.showing.paywallRelease?.htmlUrl;
  if (!htmlUrl || htmlUrl.length === 0) {
    return null;
  }

  return htmlUrl;
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

function findProductByBridgeProductId<TSchema extends VoidhashSchema>(
  products: InferGetProductResponseFromSchema<TSchema>,
  productId: string
): ResolvedProduct<TSchema> | null {
  const productList = Object.values(products).filter(
    (product): product is ResolvedProduct<TSchema> => product !== null
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

async function handlePaywallBridgeEvent<TSchema extends VoidhashSchema>(options: {
  client: VoidhashClient<TSchema>;
  locationKey: string;
  paywallOptions?: UsePaywallByLocationOptions;
  openExternalUrl: (url: string) => Promise<void>;
  presenter: PaywallPresenterBridgeAdapter;
  rawBridgeEvent: string;
}) {
  const {
    client,
    locationKey,
    openExternalUrl,
    paywallOptions,
    presenter,
    rawBridgeEvent,
  } = options;

  let bridgeEvent: ReturnType<typeof parsePaywallBridgeEnvelope>;
  try {
    bridgeEvent = parsePaywallBridgeEnvelope(rawBridgeEvent);
  } catch {
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
        bridgeEvent.requestId
      )
    );
    return;
  }

  inFlightActionByLocation.add(locationKey);
  try {
    if (bridgeEvent.type === "purchase") {
      const products = await client.getProducts();
      const product = findProductByBridgeProductId(
        products,
        bridgeEvent.payload.productId
      );

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
            bridgeEvent.requestId
          )
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
        })
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
      createPaywallBridgeSuccessResponse("restore", bridgeEvent.requestId)
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
        bridgeEvent.requestId
      )
    );
  } finally {
    inFlightActionByLocation.delete(locationKey);
  }
}

export async function __internal_handlePaywallBridgeEventForTests<
  TSchema extends VoidhashSchema,
>(options: {
  client: VoidhashClient<TSchema>;
  locationKey: string;
  paywallOptions?: UsePaywallByLocationOptions;
  openExternalUrl: (url: string) => Promise<void>;
  presenter: PaywallPresenterBridgeAdapter;
  rawBridgeEvent: string;
}) {
  await handlePaywallBridgeEvent(options);
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

export function paywallByLocationHookFactory<TSchema extends VoidhashSchema>(
  client: VoidhashClient<TSchema>,
  vhContext: React.Context<VoidhashContext<TSchema> | null>
) {
  function usePaywallByLocation(
    locationSlug: InferGetPaywallLocationInput<TSchema>,
    paywallOptions?: UsePaywallByLocationOptions
  ): UsePaywallByLocationResult {
    const voidhashContext = React.useContext(vhContext);
    const locationKey = normalizeLocation(String(locationSlug));

    const preloadPaywall = useCallback(async () => {
      if (!voidhashContext?.isInitialized || !PaywallPresenter) {
        return;
      }

      const resolvedPaywall = await client.getPaywallForLocation(locationSlug);
      const htmlUrl = getResolvedHtmlUrl(resolvedPaywall);

      if (!htmlUrl) {
        resolvedPaywallHtmlByLocation.delete(locationKey);
        return;
      }

      resolvedPaywallHtmlByLocation.set(locationKey, htmlUrl);
      await PaywallPresenter.preload(locationKey, htmlUrl);
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
      [client, locationKey, paywallOptions]
    );

    const show = useCallback(async () => {
      if (!voidhashContext?.isInitialized || !PaywallPresenter) {
        return false;
      }

      if (!resolvedPaywallHtmlByLocation.has(locationKey)) {
        await preloadPaywall();
      }

      const htmlUrl = resolvedPaywallHtmlByLocation.get(locationKey);
      if (!htmlUrl) {
        return false;
      }

      return PaywallPresenter.show(
        locationKey,
        htmlUrl,
        (rawBridgeEvent: string) => {
          void handleBridgeEvent(rawBridgeEvent);
        },
        () => {
          inFlightActionByLocation.delete(locationKey);
        }
      );
    }, [
      handleBridgeEvent,
      locationKey,
      preloadPaywall,
      voidhashContext?.isInitialized,
    ]);

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

      const appStateSubscription = AppState.addEventListener(
        "change",
        (nextState) => {
          if (nextState === "active") {
            void preloadPaywall();
          }
        }
      );

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

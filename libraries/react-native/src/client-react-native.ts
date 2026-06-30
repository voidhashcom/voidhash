import Constants from "expo-constants";
import { AtomRegistry } from "effect/unstable/reactivity";
import { Platform as RNPlatform } from "react-native";

import { VoidhashClient, type VoidhashClientOptions } from "./client";
import { SchemeNotSetError } from "./errors";
import { voidhashProviderFactory } from "./react/components/provider";
import { useRetrieveAppStoreProduct } from "./react/hooks/app-store/use-retrieve-app-store-product";
import { useRetrieveAppStoreProducts } from "./react/hooks/app-store/use-retrieve-app-store-products";
import { useRetrieveGooglePlayProduct } from "./react/hooks/google-play/use-retrieve-google-play-product";
import { useRetrieveGooglePlayProducts } from "./react/hooks/google-play/use-retrieve-google-play-products";
import { currentPersonHookFactory } from "./react/hooks/use-person";
import { featureFlagsHookFactory } from "./react/hooks/use-feature-flags";
import { paywallByLocationHookFactory } from "./react/hooks/use-paywall-by-location";
import { productsHookFactory } from "./react/hooks/use-products";
import { purchaseHookFactory } from "./react/hooks/use-purchase";

/**
 * Bootstrap the Voidhash React Native SDK for a project.
 *
 * After the server-first redesign:
 * - There is no schema argument. The schema lives on the server and is
 *   fetched on `Provider` mount.
 * - Type safety for product / location / perk slugs comes from the generated
 *   `voidhash.gen.d.ts` (run `voidhash-cli types generate`).
 */
export function createVoidhashClient(
  publishableKey: string,
  options: VoidhashClientOptions = {}
) {
  const baseUrl = options.baseUrl || "https://api.voidhash.com";
  const debug = options.debug ?? false;
  const distinctId = options.distinctId ?? null;
  const ingestUrl = options.ingestUrl;
  const readOnly = options.readOnly ?? false;
  const unstableSwallowErrors = options.unstable_swallowErrors ?? false;
  const scheme =
    options.scheme ??
    (typeof Constants.expoConfig?.scheme === "string"
      ? Constants.expoConfig?.scheme
      : Constants.expoConfig?.scheme?.[0]);

  if (!scheme) {
    throw new SchemeNotSetError();
  }

  const atomRegistry = AtomRegistry.make();
  const platform = RNPlatform.OS === "ios" ? "ios" : "android";

  const client = new VoidhashClient(
    distinctId,
    scheme,
    baseUrl,
    ingestUrl,
    publishableKey,
    readOnly,
    unstableSwallowErrors,
    atomRegistry,
    platform,
    debug,
    options.unstable_internalSchema
  );

  const { provider, context, useVoidhash } = voidhashProviderFactory(client);

  return {
    Provider: provider,
    appStore: {
      useRetrieveProduct: useRetrieveAppStoreProduct,
      useRetrieveProducts: useRetrieveAppStoreProducts,
    },
    client,
    googlePlay: {
      useRetrieveProduct: useRetrieveGooglePlayProduct,
      useRetrieveProducts: useRetrieveGooglePlayProducts,
    },
    useCurrentPerson: currentPersonHookFactory(client, context),
    useFeatureFlags: featureFlagsHookFactory(client, context),
    usePaywallByLocation: paywallByLocationHookFactory(client, context),
    useProducts: productsHookFactory(client, context),
    usePurchase: purchaseHookFactory(client),
    useVoidhash,
  };
}

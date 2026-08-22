import Constants from "expo-constants";
import { Effect } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { Platform as RNPlatform } from "react-native";

import { VoidhashClient, type VoidhashClientOptions } from "./client";
import { SchemeNotSetError } from "./errors";
import { getVoidhashEngine } from "./nitro";
import { voidhashProviderFactory } from "./react/components/provider";
import { useRetrieveAppStoreProduct } from "./react/hooks/app-store/use-retrieve-app-store-product";
import { useRetrieveAppStoreProducts } from "./react/hooks/app-store/use-retrieve-app-store-products";
import { useRetrieveGooglePlayProduct } from "./react/hooks/google-play/use-retrieve-google-play-product";
import { useRetrieveGooglePlayProducts } from "./react/hooks/google-play/use-retrieve-google-play-products";
import { currentPersonHookFactory } from "./react/hooks/use-person";
import { featureFlagsHookFactory } from "./react/hooks/use-feature-flags";
import { hasPerkHookFactory } from "./react/hooks/use-has-perk";
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
 * - `options.enabled: false` returns a fully inert client: the provider and
 *   every hook still mount (so hook order never changes), but nothing
 *   initializes, and the `scheme` requirement is waived.
 */
export function createVoidhashClient(publishableKey: string, options: VoidhashClientOptions = {}) {
  const baseUrl = options.baseUrl || "https://api.voidhash.com";
  const debug = options.debug ?? false;
  const dev = options.dev ?? false;
  const distinctId = options.distinctId ?? null;
  const enabled = options.enabled ?? true;
  const ingestUrl = options.ingestUrl;
  const readOnly = options.readOnly ?? false;
  const unstableSwallowErrors = options.unstable_swallowErrors ?? false;
  const scheme =
    options.scheme ??
    (typeof Constants.expoConfig?.scheme === "string"
      ? Constants.expoConfig?.scheme
      : Constants.expoConfig?.scheme?.[0]);

  // A disabled client never presents a paywall and so never rides the scheme
  // back into the app: requiring one would force apps that ship the SDK behind
  // a feature flag to configure a deep-link scheme they don't use yet.
  if (!scheme && enabled) {
    return Effect.runSync(Effect.die(new SchemeNotSetError()));
  }

  const atomRegistry = AtomRegistry.make();
  const platform = RNPlatform.OS === "ios" ? "ios" : "android";

  const client = new VoidhashClient(
    distinctId,
    scheme ?? "",
    baseUrl,
    ingestUrl,
    publishableKey,
    readOnly,
    unstableSwallowErrors,
    atomRegistry,
    platform,
    debug,
    options.unstable_internalSchema,
    dev,
    enabled,
    options.unstable_nativeEngine === true ? getVoidhashEngine() : undefined,
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
    useHasPerk: hasPerkHookFactory(client, context),
    usePaywallByLocation: paywallByLocationHookFactory(client, context),
    useProducts: productsHookFactory(client, context),
    usePurchase: purchaseHookFactory(client),
    useVoidhash,
  };
}

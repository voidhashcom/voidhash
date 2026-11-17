import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { AtomRegistry } from "effect/reactivity";
import { Platform } from "react-native";

import { type FeatureFlagsOptions, VoidhashClient, type VoidhashClientOptions } from "./client";
import { DIAGNOSTIC_CODES, makeDiagnosticEmitter } from "./core/diagnostics/diagnostics";
import { InvalidArgumentError } from "./errors";
import { isAnalyticsConsent } from "./core/sdk-configuration";
import { DEFAULT_FLOW_CAPABILITIES } from "./core/flows/flows";
import { createVoidhashNativeClient } from "./nitro";
import { voidhashProviderFactory } from "./react/components/provider";
import { currentPersonHookFactory } from "./react/hooks/use-person";
import { featureFlagsHookFactory } from "./react/hooks/use-feature-flags";
import { hasPerkHookFactory } from "./react/hooks/use-has-perk";
import { presentFlowHookFactory } from "./react/hooks/use-present-flow";
import { productsHookFactory } from "./react/hooks/use-products";
import { purchaseHookFactory } from "./react/hooks/use-purchase";
import { restorePurchasesHookFactory } from "./react/hooks/use-restore-purchases";
import { subscriptionsHookFactory } from "./react/hooks/use-subscriptions";

let nativeEngineWarningShown = false;

const DEFAULT_BASE_URL = "https://api.voidhash.com";

/**
 * An absolute `http(s)` URL with a host. Checked with a pattern rather than
 * `new URL()`: React Native's built-in `URL` accepts any string without
 * validating it, and apps may replace it with a stricter polyfill.
 */
const ABSOLUTE_HTTP_URL = /^https?:\/\/[^\s/?#]+(?:[/?#]\S*)?$/i;

/**
 * Resolves a configured origin, without the whitespace around it: a value read
 * from an environment file often ends with a newline, which the native URL
 * parsers refuse or turn into a host that never resolves. A missing or blank
 * value is absent. Anything else must be an absolute `http(s)` URL: requests
 * to a relative or scheme-less origin fail like an outage forever, so
 * development builds throw and release builds fall back to the default origin
 * and report it once.
 */
const resolveOrigin = (
  option: "baseUrl" | "ingestUrl",
  configured: Option.Option<string>,
  emitDiagnostic: ReturnType<typeof makeDiagnosticEmitter>,
): Option.Option<string> => {
  const value = Option.filter(
    Option.map(configured, (origin) => origin.trim()),
    (origin) => origin !== "",
  );
  if (Option.isNone(value) || ABSOLUTE_HTTP_URL.test(value.value)) return value;
  if (__DEV__) {
    throw new InvalidArgumentError(
      `${option} must be an absolute http(s) URL such as "https://api.example.com", got "${value.value}"`,
    );
  }
  emitDiagnostic({
    code: DIAGNOSTIC_CODES.INVALID_CONFIGURATION,
    kind: "configuration",
    message: `Ignored ${option} "${value.value}": it is not an absolute http(s) URL, so the default origin is used`,
    operation: "createVoidhashClient",
    retryable: false,
  });
  return Option.none();
};

/**
 * Validates the `featureFlags` option. A `maxWaitMs` that is not a
 * non-negative integer, or a default that is not a boolean, throws an
 * `INVALID_ARGUMENT` error in development builds; release builds ignore it
 * (the native default wait, or no default for that flag) and report it once.
 */
const resolveFeatureFlagOptions = (
  options: FeatureFlagsOptions,
  emitDiagnostic: ReturnType<typeof makeDiagnosticEmitter>,
) => {
  const refuse = (message: string, fallback: string) => {
    if (__DEV__) throw new InvalidArgumentError(message);
    emitDiagnostic({
      code: DIAGNOSTIC_CODES.INVALID_CONFIGURATION,
      kind: "configuration",
      message: `Ignored ${message}; ${fallback}`,
      operation: "createVoidhashClient",
      retryable: false,
    });
  };
  const isValidWait = (wait: number) => Number.isInteger(wait) && wait >= 0;
  const maxWaitMs = Option.fromUndefinedOr(options.maxWaitMs);
  if (Option.isSome(maxWaitMs) && !isValidWait(maxWaitMs.value)) {
    refuse(
      `featureFlags.maxWaitMs must be zero or a positive integer, got ${String(maxWaitMs.value)}`,
      "the default wait is used",
    );
  }
  const configuredDefaults: Readonly<Record<string, unknown>> = options.defaults ?? {};
  R.toEntries(configuredDefaults).forEach(([key, value]) => {
    if (P.isBoolean(value)) return;
    refuse(
      `featureFlags.defaults["${key}"] must be true or false, got ${String(value)}`,
      "the flag has no default",
    );
  });
  const defaults = R.filter(configuredDefaults, P.isBoolean);
  return { defaults, maxWaitMs: Option.filter(maxWaitMs, isValidWait) };
};

/**
 * Bootstrap the Voidhash React Native SDK for a project.
 *
 * After the server-first redesign:
 * - There is no schema argument. The schema lives on the server and is
 *   fetched on `Provider` mount.
 * - Type safety for product / location / perk slugs comes from the generated
 *   `voidhash.gen.d.ts` (run `voidhash-cli types generate`).
 * - No `publishableKey` (`null`, `undefined` or blank), a platform other
 *   than iOS and Android, or `options.enabled: false` returns a fully inert
 *   client: the provider and
 *   every hook still mount (so hook order never changes), but nothing
 *   initializes.
 * - An `analyticsConsent` other than `"granted"`, `"denied"` or `"pending"`
 *   throws an `INVALID_ARGUMENT` error in development builds; release builds
 *   use `"granted"` and report `INVALID_CONFIGURATION`.
 * - A `featureFlags.maxWaitMs` that is not zero or a positive integer, or a
 *   `featureFlags.defaults` entry that is not a boolean, throws an
 *   `INVALID_ARGUMENT` error in development builds; release builds ignore it
 *   and report `INVALID_CONFIGURATION`.
 * - A blank `distinctId`, `baseUrl` or `ingestUrl` counts as absent, and
 *   whitespace around a `baseUrl` or `ingestUrl` is removed. A
 *   `baseUrl` or `ingestUrl` that is not an absolute `http(s)` URL throws an
 *   `INVALID_ARGUMENT` error in development builds; release builds use the
 *   default origin and report `INVALID_CONFIGURATION` through `onDiagnostic`.
 */
export function createVoidhashClient(
  // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK input from non-Effect app code; an environment without a key naturally holds null or undefined.
  publishableKey: string | null | undefined,
  options: VoidhashClientOptions = {},
) {
  const key = publishableKey?.trim() ?? "";
  const emitDiagnostic = makeDiagnosticEmitter(Option.fromUndefinedOr(options.onDiagnostic));
  const baseUrl = Option.getOrElse(
    resolveOrigin("baseUrl", Option.fromUndefinedOr(options.baseUrl), emitDiagnostic),
    () => DEFAULT_BASE_URL,
  );
  const debug = options.debug ?? false;
  const dev = options.dev ?? false;
  const distinctId = Option.fromUndefinedOr(options.distinctId);
  const enabled =
    (options.enabled ?? true) && key !== "" && (Platform.OS === "ios" || Platform.OS === "android");
  const ingestUrl = resolveOrigin(
    "ingestUrl",
    Option.fromUndefinedOr(options.ingestUrl),
    emitDiagnostic,
  );
  const readOnly = options.readOnly ?? false;
  const analyticsConsent = options.analyticsConsent ?? "granted";
  if (!isAnalyticsConsent(analyticsConsent)) {
    const message = `analyticsConsent must be "granted", "denied" or "pending", got "${String(analyticsConsent)}"`;
    if (__DEV__) throw new InvalidArgumentError(message);
    emitDiagnostic({
      code: DIAGNOSTIC_CODES.INVALID_CONFIGURATION,
      kind: "configuration",
      message: `Ignored ${message}; "granted" is used`,
      operation: "createVoidhashClient",
      retryable: false,
    });
  }
  const featureFlags = resolveFeatureFlagOptions(options.featureFlags ?? {}, emitDiagnostic);
  if (options.unstable_nativeEngine === true && __DEV__ && !nativeEngineWarningShown) {
    nativeEngineWarningShown = true;
    // oxlint-disable-next-line effect/use-console-service -- a one-time development notice for the app developer, printed before any SDK runtime exists.
    console.warn(
      "[voidhash] unstable_nativeEngine no longer has an effect; the SDK always runs on its native client.",
    );
  }

  const client = new VoidhashClient({
    analyticsConsent: isAnalyticsConsent(analyticsConsent) ? analyticsConsent : "granted",
    analyticsWhilePending: options.analyticsWhilePending === "buffer" ? "buffer" : "drop",
    appStoreMessages:
      options.appStoreMessages === "automatic" ? "automatic" : "deferWhileFlowPresented",
    atomRegistry: AtomRegistry.make(),
    automaticLifecycleEvents: options.automaticLifecycleEvents ?? true,
    baseUrl,
    createNativeClient: createVoidhashNativeClient,
    debug,
    developmentMode: __DEV__ && dev,
    // A blank configured id counts as absent: the SDK keeps (or mints) the
    // anonymous identity instead of adopting one no request can carry.
    distinctId: Option.filter(distinctId, (id) => P.isString(id) && id.trim() !== ""),
    enabled,
    featureFlagDefaults: featureFlags.defaults,
    featureFlagMaxWaitMs: featureFlags.maxWaitMs,
    grantConsentOnIdentify: options.grantConsentOnIdentify ?? false,
    flowCapabilities: Arr.dedupe(options.flowCapabilities ?? DEFAULT_FLOW_CAPABILITIES),
    flowRevisions: options.flowRevisions ?? {},
    flowRuntime: options.flowRuntime === "module" ? "module" : "linked",
    ingestUrl,
    installAttribution: options.installAttribution ?? true,
    internalSchema: Option.fromUndefinedOr(options.unstable_internalSchema),
    metaAppId: Option.fromUndefinedOr(options.metaAppId),
    oneNativeClientPerProcess: Platform.OS === "android",
    onDiagnostic: Option.fromUndefinedOr(options.onDiagnostic),
    platform: Platform.OS,
    preloadLocations: options.preloadLocations ?? [],
    publishableKey: key,
    purchaseIntents: options.purchaseIntents === "manual" ? "manual" : "purchaseWhenReady",
    readOnly,
    scheme: options.scheme ?? "",
    screenTracking: options.screenTracking ?? {},
    unstableSwallowErrors: options.unstable_swallowErrors ?? false,
  });

  const { provider, context, useVoidhash } = voidhashProviderFactory(client);
  const useCurrentPerson = currentPersonHookFactory(client, context);

  return {
    Provider: provider,
    /** App Store actions, as `client.appStore`. */
    appStore: client.appStore,
    client,
    /** Google Play actions, as `client.googlePlay`. */
    googlePlay: client.googlePlay,
    useCurrentPerson,
    useFeatureFlags: featureFlagsHookFactory(client, context),
    useHasPerk: hasPerkHookFactory(client, context),
    usePresentFlow: presentFlowHookFactory(client, context),
    useProducts: productsHookFactory(client, context),
    usePurchase: purchaseHookFactory(client, context),
    useRestorePurchases: restorePurchasesHookFactory(client, context),
    useSubscriptions: subscriptionsHookFactory(
      currentPersonHookFactory(client, context, "useSubscriptions"),
    ),
    useVoidhash,
  };
}

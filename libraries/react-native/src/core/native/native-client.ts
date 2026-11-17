import { Result } from "better-result";
import * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Match from "effect/Match";
import * as MutableRef from "effect/MutableRef";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as EffectResult from "effect/Result";
import * as Schema from "effect/Schema";
import { Atom, type AtomRegistry } from "effect/reactivity";
import type { HybridObject } from "react-native-nitro-modules";

import type {
  CurrentPersonResult,
  FlushResult,
  HasPerkResult,
  IdentifyResult,
  SetPersonAttributesResult,
} from "../../client";
import {
  NotInitializedError,
  VOIDHASH_ERROR_CODES,
  VoidhashError,
  type VoidhashErrorCode,
  type VoidhashErrorReason,
} from "../../errors";
import type {
  NativeAnalyticsConsent,
  NativeClientConfiguration,
  NativeClientEvent,
  NativeDiagnostic,
  NativeFeatureFlag,
  NativeFeatureFlagsResult,
  NativeFlushStatus,
  NativeFreshnessReason,
  NativeIdentityChange,
  NativePersonState,
  NativePersonWriteResult,
  NativePurchaseOptions,
  NativeReportedTransaction,
  NativeStorefront,
  VoidhashNativeClient,
} from "../../specs/VoidhashNativeClient.nitro";
import { toJsonSafeProperties } from "../analytics/json-safe";
import type { VoidhashDiagnostic } from "../diagnostics/diagnostics";
import { findActiveGrant } from "../entitlements/find-grant";
import {
  type AppStorePurchaseIntent,
  type AppStoreSubscriptionStatus,
  type AppTransaction,
  decodeAppStoreRenewalInfo,
  decodeAppTransaction,
  type RefundRequestStatus,
} from "../entities/app-store";
import type { GooglePlayInAppMessageResult } from "../entities/google-play";
import { decodePerson, type Person } from "../entities/person";
import type { Product } from "../entities/product";
import type { TransactionUpdate } from "../entities/transaction";
import {
  flowError,
  type FlowErrorCode,
  type FlowResult,
  parseFlowResult,
  type PresentFlowOptions,
} from "../flows/flows";
import type {
  FeatureFlagsResult,
  GroupProperties,
  Groups,
  PersonAttributes,
  ResolvedPaywall,
  SdkFeatureFlag,
} from "../facade-types";
import {
  currentPersonAtom,
  currentPersonFreshnessAtom,
  featureFlagsByKeyAtom,
  identityEpochAtom,
  NO_PRODUCTS,
  normalizeFeatureFlagKeys,
  productsAtom,
  publishCurrentPerson,
  schemaAtom,
  UNCONFIRMED_PERSON,
} from "../reactivity/client-state";
import type { FlowValues, PerkSlug } from "../schema/registry";
import { decodeRuntimeSchema } from "../schema/decode";
import { type AnalyticsConsent, isAnalyticsConsent } from "../sdk-configuration";
import { readNativeError } from "../utils/native-error";
import { type StorePurchaseResult, toProduct, toPurchaseResult, toTransaction } from "./billing";

/**
 * The hybrid as the adapter uses it: its members without Nitro's own object
 * plumbing, so tests can hand in an in-memory implementation.
 */
export type NativeClientPort = Omit<
  VoidhashNativeClient,
  keyof HybridObject<{ ios: "swift"; android: "kotlin" }>
>;

/** What the adapter reports to and through, besides the hybrid itself. */
export interface NativeClientAdapterOptions {
  readonly native: NativeClientPort;
  /** The client's registry; the hooks read the atoms the adapter writes into it. */
  readonly atomRegistry: AtomRegistry.AtomRegistry;
  /** Receives every native diagnostic; the facade's `onDiagnostic` dispatch. */
  readonly onDiagnostic: (diagnostic: VoidhashDiagnostic) => void;
  /**
   * Called when the native client switched to another identity, as soon as it
   * says so: the events it is handed from here on are recorded under it.
   */
  readonly onIdentitySwitched?: () => void;
  /** Called when the analytics consent in effect changes natively, including at start. */
  readonly onAnalyticsConsentChanged?: (consent: AnalyticsConsent) => void;
  /** Receives each purchase the native client completed outside `purchase()`. */
  readonly onTransaction?: (update: TransactionUpdate) => void;
  /** Receives each App Store purchase intent, with `purchaseIntents: "manual"`. */
  readonly onPurchaseIntent?: (intent: AppStorePurchaseIntent) => void;
}

/**
 * The version of the contract in `VoidhashNativeClient.nitro.ts` this facade
 * speaks; the native client's `contractVersion()` must answer the same.
 */
export const NATIVE_CONTRACT_VERSION = 1;

/**
 * The contract version `native` implements: 0 for a binary built before
 * `contractVersion()` existed, whose hybrid has no such member, and for one
 * that answers no number.
 */
const contractVersionOf = (native: NativeClientPort): number => {
  const version = EffectResult.try(() =>
    P.isFunction(Reflect.get(native, "contractVersion")) ? native.contractVersion() : 0,
  );
  return EffectResult.isSuccess(version) && P.isNumber(version.success) ? version.success : 0;
};

/** Native codes for a client that is not started, the facade's `VOIDHASH_CLIENT_NOT_INITIALIZED`. */
const NOT_STARTED_CODES: ReadonlyArray<string> = ["NOT_INITIALIZED", "NOT_CONFIGURED"];

/**
 * How one facade method reports a native failure: under its own code, except
 * for the codes it reports today, which pass through.
 */
interface FailureCodes {
  readonly fallback: VoidhashErrorCode;
  /** Codes the facade method reports today besides `fallback`. */
  readonly passThrough?: ReadonlyArray<VoidhashErrorCode>;
  /**
   * Whether a client that is not started is reported as
   * `VOIDHASH_CLIENT_NOT_INITIALIZED`, as every facade method but `init()`
   * does. Default `true`.
   */
  readonly notStarted?: boolean;
}

/**
 * Maps a native rejection to the error the facade method reports. The code
 * is read through the bridge's wrapping (`readNativeError`): a code the method
 * reports today keeps it, a client that is not started is the facade's
 * `NotInitializedError`, and anything else is reported as the method's own
 * code with the native message's first line kept, so no stack trace reaches
 * the app.
 */
export const toVoidhashError = (error: unknown, codes: FailureCodes): VoidhashError => {
  if (error instanceof VoidhashError) return error;
  const native = readNativeError(error);
  const code = Option.getOrElse(native.code, () => "");
  if ((codes.notStarted ?? true) && NOT_STARTED_CODES.includes(code)) {
    return new NotInitializedError();
  }
  const passing = Arr.findFirst(codes.passThrough ?? [], (known) => known === code);
  return Option.match(passing, {
    onNone: () =>
      new VoidhashError(codes.fallback, `${codes.fallback}: ${native.message}`, { cause: error }),
    onSome: (known) => new VoidhashError(known, native.message, { cause: error }),
  });
};

/** What every facade method below reports, keyed by the method. */
const FAILURES = {
  appStoreAppTransaction: {
    fallback: "FAILED_TO_GET_APP_TRANSACTION",
    passThrough: ["UNSUPPORTED_PLATFORM"],
  },
  appStoreBeginRefundRequest: {
    fallback: "FAILED_TO_BEGIN_REFUND_REQUEST",
    passThrough: ["INVALID_ARGUMENT", "UNSUPPORTED_PLATFORM"],
  },
  appStoreCurrentEntitlements: {
    fallback: "FAILED_TO_GET_CURRENT_ENTITLEMENTS",
    passThrough: ["UNSUPPORTED_PLATFORM"],
  },
  appStoreSubscriptionStatus: {
    fallback: "FAILED_TO_GET_SUBSCRIPTION_STATUS",
    passThrough: ["UNSUPPORTED_PLATFORM"],
  },
  canMakePayments: { fallback: "FAILED_TO_CHECK_CAN_MAKE_PAYMENTS" },
  dismissFlow: { fallback: "FLOW_PRESENTATION_FAILED" },
  updateFlowInput: { fallback: "FLOW_PRESENTATION_FAILED" },
  flush: { fallback: "FAILED_TO_FLUSH_ANALYTICS" },
  getCurrentPerson: {
    fallback: "FAILED_TO_GET_CURRENT_PERSON",
    passThrough: ["AUTHENTICATION_FAILED"],
  },
  getDistinctId: { fallback: "FAILED_TO_GET_DISTINCT_ID" },
  getFeatureFlags: {
    fallback: "FAILED_TO_GET_FEATURE_FLAGS",
    passThrough: ["AUTHENTICATION_FAILED"],
  },
  getPaywallForLocation: {
    fallback: "FAILED_TO_GET_PAYWALL_FOR_LOCATION",
    passThrough: ["AUTHENTICATION_FAILED", "PAYWALL_UNAVAILABLE"],
  },
  getProducts: { fallback: "FAILED_TO_GET_PRODUCTS" },
  getStorefront: { fallback: "FAILED_TO_GET_STOREFRONT" },
  googlePlayIsFeatureSupported: {
    fallback: "FAILED_TO_CHECK_FEATURE_SUPPORT",
    passThrough: ["INVALID_ARGUMENT", "UNSUPPORTED_PLATFORM"],
  },
  googlePlayQueryPurchases: {
    fallback: "FAILED_TO_QUERY_PURCHASES",
    passThrough: ["UNSUPPORTED_PLATFORM"],
  },
  googlePlayShowInAppMessages: {
    fallback: "FAILED_TO_SHOW_IN_APP_MESSAGES",
    passThrough: ["UNSUPPORTED_PLATFORM"],
  },
  group: { fallback: "FAILED_TO_SET_GROUP", passThrough: ["INVALID_ARGUMENT"] },
  setGroups: { fallback: "FAILED_TO_SET_GROUP", passThrough: ["INVALID_ARGUMENT"] },
  identify: { fallback: "FAILED_TO_IDENTIFY", passThrough: ["INVALID_ARGUMENT"] },
  presentCodeRedemption: { fallback: "FAILED_TO_PRESENT_CODE_REDEMPTION" },
  purchase: {
    fallback: "FAILED_TO_PURCHASE",
    passThrough: [
      "INVALID_ARGUMENT",
      "OFFER_UNAVAILABLE",
      "PURCHASE_IN_PROGRESS",
      "READ_ONLY_PURCHASE_NOT_ALLOWED",
      "REPLACED_SUBSCRIPTION_NOT_OWNED",
      "SUBSCRIPTION_REPLACEMENT_REFUSED",
    ],
  },
  reportTransaction: { fallback: "FAILED_TO_REPORT_TRANSACTION" },
  reset: { fallback: "FAILED_TO_RESET" },
  resetCache: { fallback: "FAILED_TO_RESET_PERSON_CACHE" },
  resetGroups: { fallback: "FAILED_TO_RESET_GROUPS" },
  restorePurchases: { fallback: "FAILED_TO_RESTORE_PURCHASES" },
  setAnalyticsConsent: { fallback: "FAILED_TO_SET_ANALYTICS_CONSENT" },
  setPersonAttributes: {
    fallback: "FAILED_TO_SET_PERSON_ATTRIBUTES",
    passThrough: ["INVALID_ARGUMENT"],
  },
  setPersonAttributesSync: {
    fallback: "FAILED_TO_SET_PERSON_ATTRIBUTES_SYNC",
    passThrough: ["INVALID_ARGUMENT", "READ_ONLY_PURCHASE_NOT_ALLOWED"],
  },
  showManageSubscriptions: { fallback: "FAILED_TO_SHOW_MANAGE_SUBSCRIPTIONS" },
  shutdown: { fallback: "FAILED_TO_END_VOIDHASH_CLIENT" },
  signOut: { fallback: "FAILED_TO_SIGN_OUT" },
  start: { fallback: "FAILED_TO_INITIALIZE_VOIDHASH_CLIENT", notStarted: false },
  syncPurchases: { fallback: "FAILED_TO_SYNC_PURCHASES" },
} as const satisfies Record<string, FailureCodes>;

/**
 * Runs one native call and answers it as the facade does: `Ok` with the
 * mapped value, or `Err` with the mapped error. A native call that throws
 * synchronously is a rejection like any other.
 */
const call = async <A>(
  codes: FailureCodes,
  run: () => Promise<A>,
): Promise<Result<A, VoidhashError>> => {
  const exit = await Effect.runPromiseExit(
    Effect.tryPromise({ catch: (error) => error, try: () => run() }),
  );
  return Exit.isSuccess(exit)
    ? Result.ok(exit.value)
    : Result.err(toVoidhashError(Cause.squash(exit.cause), codes));
};

/** The native codes of a purchase the store refused for a reason, and the reason each is. */
const PURCHASE_FAILURE_REASONS: Readonly<Record<string, VoidhashErrorReason>> = {
  INELIGIBLE_FOR_OFFER: "ineligibleForOffer",
  PAYMENT_DECLINED: "paymentDeclined",
};

const decodeJson = Schema.decodeUnknownResult(Schema.fromJsonString(Schema.Unknown));
const encodeJson = Schema.encodeUnknownResult(Schema.fromJsonString(Schema.Unknown));

const PaywallValue = Schema.declare(
  (value: unknown): value is ResolvedPaywall => value === null || P.isObject(value),
);
const decodePaywall = Schema.decodeUnknownResult(PaywallValue);

/** A person snapshot crossing as JSON; one that is absent or unreadable counts as none. */
const personOf = (payload: { readonly personJson?: string }): Option.Option<Person> =>
  Option.flatMap(Option.fromUndefinedOr(payload.personJson), decodePerson);

const REASONS: Readonly<Record<NativeFreshnessReason, CurrentPersonResult["reason"]>> = {
  fresh: "fresh",
  noCache: "no-cache",
  refreshFailed: "refresh-failed",
  refreshInFlight: "refresh-in-flight",
};

const toCurrentPerson = (state: NativePersonState): CurrentPersonResult => ({
  isExpired: state.isExpired,
  isStale: state.isStale,
  person: Option.getOrNull(personOf(state)),
  reason: REASONS[state.reason],
});

const toFlag = (flag: NativeFeatureFlag): SdkFeatureFlag => ({
  enabled: flag.enabled,
  key: flag.key,
  payload: Option.getOrNull(
    Option.flatMap(Option.fromUndefinedOr(flag.payloadJson), (json) =>
      EffectResult.getSuccess(decodeJson(json)),
    ),
  ),
  variantKey: flag.variantKey ?? null,
});

const toFlags = (result: NativeFeatureFlagsResult): FeatureFlagsResult => ({
  flags: result.flags.map(toFlag),
  isStale: result.isStale,
});

const toDiagnostic = (diagnostic: NativeDiagnostic): VoidhashDiagnostic => ({
  code: diagnostic.code,
  kind: diagnostic.kind,
  operation: diagnostic.operation,
  retryable: diagnostic.retryable,
  ...(diagnostic.httpStatus === undefined ? {} : { httpStatus: diagnostic.httpStatus }),
  ...(diagnostic.message === undefined ? {} : { message: diagnostic.message }),
});

const toFlushResult = (status: NativeFlushStatus): FlushResult => ({
  flushed: status.flushed,
  pending: status.pending,
  ...(status.lastErrorMessage === undefined
    ? {}
    : {
        lastError: new VoidhashError(
          "FAILED_TO_FLUSH_ANALYTICS",
          `FAILED_TO_FLUSH_ANALYTICS: ${status.lastErrorMessage}`,
        ),
      }),
});

/** Inputs, action arguments and action replies as the native side carries them. */
const FlowValuesFromJson = Schema.fromJsonString(
  Schema.Record(
    Schema.String,
    Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Array(Schema.String)]),
  ),
);
const decodeFlowValues = Schema.decodeUnknownSync(FlowValuesFromJson);
const encodeFlowValues = Schema.encodeSync(FlowValuesFromJson);

/** Whether a native code is one of the `FLOW_*` codes a presentation rejects with. */
const isFlowErrorCode = (code: string): code is FlowErrorCode =>
  code.startsWith("FLOW_") && VOIDHASH_ERROR_CODES.some((known) => known === code);

/**
 * The facade's view of the native Voidhash client: every method answers in
 * the facade's types (`Result` with a coded `VoidhashError`), and every native
 * state change lands in the reactive atoms the hooks read, so the hooks work
 * unchanged whichever side produced the state.
 *
 * The adapter follows the identity generation the native client last
 * announced, by event or in the answer of the call that switched it. A person
 * or flag answer, read or event, from any other generation is not published:
 * it belongs to a switch that has already been superseded, or to an earlier
 * run of the client (generations grow for the life of the process), even when
 * the identity has since switched back to the same distinct id. A read still
 * answers its caller with what it read.
 */
export const makeNativeClientAdapter = (options: NativeClientAdapterOptions) => {
  const { atomRegistry, native } = options;
  const currentIdentity = MutableRef.make(Option.none<NativeIdentityChange>());
  /** The generation person or flags were last published for; `-1` before any. */
  const publishedGeneration = MutableRef.make(-1);
  const listening = MutableRef.make(false);
  /**
   * Counts what made the products this client holds outdated: identity
   * switches, product definition changes, purchases and restores. A load
   * publishes only when nothing outdated it while it ran.
   */
  const productsRevision = MutableRef.make(0);
  const productsLoad = MutableRef.make(
    Option.none<{
      readonly revision: number;
      readonly settled: Promise<Result<ReadonlyArray<Product>, VoidhashError>>;
    }>(),
  );
  /** The reload `invalidateProducts()` scheduled for the next tick, until it starts. */
  const scheduledReload = MutableRef.make(Option.none<ReturnType<typeof setTimeout>>());
  /** The product definitions of the schema published last, encoded; empty before any. */
  const productDefinitions = MutableRef.make("");

  /** The host's diagnostic handler, which must not take the adapter down with it. */
  const report = (diagnostic: VoidhashDiagnostic) => {
    EffectResult.try(() => options.onDiagnostic(diagnostic));
  };

  const cancelScheduledReload = () => {
    Option.map(MutableRef.get(scheduledReload), clearTimeout);
    MutableRef.set(scheduledReload, Option.none());
  };

  /**
   * Loads the products, one native call for every caller of the same
   * revision, and publishes them for the hooks. A load that an identity
   * switch, a schema change or a purchase outdated while it ran answers its
   * caller but publishes nothing: the load started for the new revision does.
   *
   * Never rejects: a product this SDK cannot read fails the load as
   * `FAILED_TO_GET_PRODUCTS`, like a native failure, and a settled load
   * never leaves the products loading.
   */
  const loadProducts = (): Promise<Result<ReadonlyArray<Product>, VoidhashError>> => {
    const revision = MutableRef.get(productsRevision);
    const running = MutableRef.get(productsLoad);
    if (Option.isSome(running) && running.value.revision === revision) {
      return running.value.settled;
    }
    // This load serves every change so far; a reload scheduled for them is not needed.
    cancelScheduledReload();
    atomRegistry.update(productsAtom, (state) => ({ ...state, isLoading: true }));
    const settled: Promise<Result<ReadonlyArray<Product>, VoidhashError>> = call(
      FAILURES.getProducts,
      async () =>
        Arr.getSomes(
          (await native.getProducts()).map((product) =>
            toProduct(product, (message) => reportContractViolation("getProducts", message)),
          ),
        ),
    ).then((products) => {
      const isCurrent = MutableRef.get(productsRevision) === revision;
      if (Option.exists(MutableRef.get(productsLoad), (load) => load.settled === settled)) {
        MutableRef.set(productsLoad, Option.none());
      }
      if (isCurrent) {
        atomRegistry.update(productsAtom, (state) =>
          products.isOk()
            ? { error: Option.none(), isLoading: false, products: Option.some(products.value) }
            : { ...state, error: Option.some(products.error), isLoading: false },
        );
      } else if (
        Option.isNone(MutableRef.get(productsLoad)) &&
        Option.isNone(MutableRef.get(scheduledReload))
      ) {
        // Outdated, and no load for the new revision runs or is due.
        atomRegistry.update(productsAtom, (state) => ({ ...state, isLoading: false }));
      }
      return products;
    });
    MutableRef.set(productsLoad, Option.some({ revision, settled }));
    return settled;
  };

  /**
   * The products held are outdated. They load again when anything asked for
   * them before (otherwise the first `useProducts()` or `getProducts()` loads
   * them), on the next tick: changes that land together, such as an identity
   * switch and a schema, or several transactions, load once.
   */
  const invalidateProducts = () => {
    MutableRef.update(productsRevision, (revision) => revision + 1);
    if (Option.isSome(MutableRef.get(scheduledReload))) return;
    const state = atomRegistry.get(productsAtom);
    if (Option.isNone(state.products) && Option.isNone(state.error) && !state.isLoading) return;
    MutableRef.set(
      scheduledReload,
      Option.some(
        setTimeout(() => {
          MutableRef.set(scheduledReload, Option.none());
          void loadProducts();
        }, 0),
      ),
    );
  };

  const isCurrent = (generation: number) =>
    Option.exists(
      MutableRef.get(currentIdentity),
      (identity) => identity.generation === generation,
    );

  const publishPerson = (state: NativePersonState) => {
    if (!isCurrent(state.generation)) return;
    MutableRef.set(publishedGeneration, state.generation);
    publishCurrentPerson(atomRegistry, personOf(state), {
      isExpired: state.isExpired,
      isStale: state.isStale,
    });
  };

  /** Stores an evaluation under `signature`, the key set it is published for. */
  const publishFlags = (result: NativeFeatureFlagsResult, signature: string) => {
    if (!isCurrent(result.generation)) return;
    MutableRef.set(publishedGeneration, result.generation);
    atomRegistry.update(featureFlagsByKeyAtom, (current) => ({
      ...current,
      [signature]: toFlags(result),
    }));
  };

  /**
   * Adopts the identity the native client switched to. A switch clears the
   * person and every flag evaluation and counts in `identityEpochAtom`, so
   * mounted hooks read again for the new identity, as `IdentityManager` does
   * for the TypeScript core. A generation no newer than the current one (the
   * event of a switch whose answer was already adopted, say) changes nothing.
   */
  const adoptIdentity = (change: NativeIdentityChange) => {
    if (
      Option.exists(
        MutableRef.get(currentIdentity),
        (current) => current.generation >= change.generation,
      )
    ) {
      return;
    }
    MutableRef.set(currentIdentity, Option.some(change));
    options.onIdentitySwitched?.();
    Atom.batch(() => {
      atomRegistry.set(featureFlagsByKeyAtom, {});
      publishCurrentPerson(atomRegistry, Option.none(), UNCONFIRMED_PERSON);
      atomRegistry.update(identityEpochAtom, (switches) => switches + 1);
    });
    // Offers and intro eligibility are the end user's.
    invalidateProducts();
  };

  const reportContractViolation = (operation: string, message: string) =>
    report({
      code: "BACKGROUND_TASK_FAILED",
      kind: "configuration",
      message,
      operation,
      retryable: false,
    });

  /**
   * Publishes a schema event. Decoded entry by entry like a fetched schema:
   * an entry this SDK version cannot read is left out (the native client
   * reports it); a document that is no schema at all is reported and dropped.
   */
  const publishSchema = (schemaJson: string) => {
    const decoded = EffectResult.flatMap(decodeJson(schemaJson), (document) => {
      const exit = Effect.runSyncExit(decodeRuntimeSchema(document));
      return Exit.isSuccess(exit)
        ? EffectResult.succeed(exit.value.schema)
        : EffectResult.fail(Cause.squash(exit.cause));
    });
    if (EffectResult.isSuccess(decoded)) {
      atomRegistry.set(schemaAtom, Option.some(decoded.success));
      // Every refresh publishes a new schema; only changed product definitions outdate the products.
      const definitions = EffectResult.getOrElse(encodeJson(decoded.success.products), () => "");
      if (definitions !== MutableRef.get(productDefinitions)) {
        MutableRef.set(productDefinitions, definitions);
        invalidateProducts();
      }
      return;
    }
    reportContractViolation("getSchema", "The native client sent a schema this SDK cannot read");
  };

  /** Routes one event; the event's `type` names the payload it carries. */
  const routeEvent = (event: NativeClientEvent) =>
    Match.value(event.type).pipe(
      Match.when("identity", () =>
        Option.map(Option.fromUndefinedOr(event.identity), adoptIdentity),
      ),
      Match.when("person", () => Option.map(Option.fromUndefinedOr(event.person), publishPerson)),
      Match.when("flags", () =>
        Option.map(Option.fromUndefinedOr(event.flags), (flags) =>
          publishFlags(flags, normalizeFeatureFlagKeys(flags.flagKeys)),
        ),
      ),
      Match.when("schema", () =>
        Option.map(Option.fromUndefinedOr(event.schemaJson), publishSchema),
      ),
      Match.when("consent", () =>
        Option.map(Option.fromUndefinedOr(event.consent), (consent) =>
          options.onAnalyticsConsentChanged?.(consent),
        ),
      ),
      Match.when("diagnostic", () =>
        Option.map(Option.fromUndefinedOr(event.diagnostic), (diagnostic) =>
          report(toDiagnostic(diagnostic)),
        ),
      ),
      Match.when("transaction", () =>
        Option.map(Option.fromUndefinedOr(event.transaction), (update) => {
          // A completed purchase can change which offers the end user is eligible for; a
          // renewal of a subscription they already have cannot.
          if (update.transaction.isRenewal !== true) invalidateProducts();
          options.onTransaction?.({
            synced: update.synced,
            transaction: toTransaction(update.transaction, (message) =>
              reportContractViolation("transactionUpdates", message),
            ),
          });
        }),
      ),
      Match.when("purchaseIntent", () =>
        Option.map(Option.fromUndefinedOr(event.purchaseIntent), (intent) =>
          options.onPurchaseIntent?.({
            productSlug: intent.productSlug,
            ...(intent.offer === undefined ? {} : { offer: intent.offer }),
          }),
        ),
      ),
      Match.exhaustive,
    );

  /**
   * The listener handed to the native client. Whatever goes wrong while an
   * event is handled (a host callback or a hook's render throwing) is
   * reported as a diagnostic instead of escaping into the native bridge.
   */
  const handleEvent = (event: NativeClientEvent) => {
    if (!MutableRef.get(listening)) return;
    const handled = EffectResult.try(() => routeEvent(event));
    if (EffectResult.isFailure(handled)) {
      report({
        code: "BACKGROUND_TASK_FAILED",
        kind: "configuration",
        message: `Handling a native ${event.type} event failed: ${String(handled.failure)}`,
        operation: "nativeEvent",
        retryable: false,
      });
    }
  };

  /**
   * Reports a synchronous native call that threw. These calls answer no
   * `Result`, so the failure is a diagnostic rather than an exception that
   * would escape the facade.
   */
  const reportThrow = (operation: string, error: unknown) =>
    report({
      code: "BACKGROUND_TASK_FAILED",
      kind: "configuration",
      message: `${operation} failed: ${readNativeError(error).message}`,
      operation,
      retryable: false,
    });

  /** Runs a synchronous native call, reporting a throw; `None` when it threw. */
  const trySync = <A>(operation: string, run: () => A): Option.Option<A> => {
    const ran = EffectResult.try(run);
    if (EffectResult.isSuccess(ran)) return Option.some(ran.success);
    reportThrow(operation, ran.failure);
    return Option.none();
  };

  const stopListening = () => {
    MutableRef.set(listening, false);
    trySync("removeEventListener", () => native.removeEventListener());
  };

  /** Reads the person and publishes it, unless the identity changed meanwhile. */
  const readPerson = (forceFetch: boolean) =>
    call(FAILURES.getCurrentPerson, async () => {
      const state = await native.getPersonState(forceFetch);
      publishPerson(state);
      return state;
    });

  /**
   * Switches the identity through the native client. The switch is adopted
   * from the answer as well as from the event, so the atoms follow it however
   * the two arrive. A switch the server refused leaves the native client back
   * on the previous identity; the person and flag evaluations held before the
   * call are then put back, as `IdentityManager` does for the TypeScript core,
   * unless something was already published for the generations since. An
   * identify of the current identity adopts nothing and leaves both alone.
   */
  const switchIdentity = async (
    externalUserId: string,
    profile: { email?: string; name?: string },
  ) => {
    const before = MutableRef.get(currentIdentity);
    const held = {
      flags: atomRegistry.get(featureFlagsByKeyAtom),
      freshness: atomRegistry.get(currentPersonFreshnessAtom),
      person: atomRegistry.get(currentPersonAtom),
    };
    const result = await call(FAILURES.identify, () =>
      native.identify(externalUserId, profile.email, profile.name),
    );
    if (result.isOk()) {
      adoptIdentity(result.value.identity);
      return result;
    }
    const after = MutableRef.get(currentIdentity);
    const restored =
      Option.isSome(before) &&
      Option.isSome(after) &&
      after.value.distinctId === before.value.distinctId &&
      after.value.generation > before.value.generation &&
      MutableRef.get(publishedGeneration) <= before.value.generation;
    if (restored) {
      Atom.batch(() => {
        atomRegistry.set(featureFlagsByKeyAtom, held.flags);
        publishCurrentPerson(atomRegistry, held.person, held.freshness);
      });
    }
    return result;
  };

  /** Resets or signs out, adopting the fresh identity from the answer too. */
  const switchToAnonymous = async (codes: FailureCodes, run: () => Promise<NativeIdentityChange>) =>
    (await call(codes, run)).map((identity) => {
      adoptIdentity(identity);
      return undefined;
    });

  const toAttributesResult = (result: NativePersonWriteResult): SetPersonAttributesResult => {
    const person = personOf(result);
    if (result.status === "skipped") return { person: null, status: "skipped" };
    return result.status === "confirmed" && Option.isSome(person)
      ? { person: person.value, status: "confirmed" }
      : { person: Option.getOrNull(person), status: "deferred" };
  };

  /**
   * Encodes person attributes for the bridge. Attributes JSON cannot hold
   * are an `INVALID_ARGUMENT`, never sent as something else.
   */
  const encodeAttributes = (attributes: PersonAttributes) =>
    Option.match(EffectResult.getSuccess(encodeJson(attributes)), {
      onNone: () =>
        Result.err(
          new VoidhashError(
            "INVALID_ARGUMENT",
            "INVALID_ARGUMENT: person attributes must be values JSON can hold",
          ),
        ),
      onSome: (json) => Result.ok(json),
    });

  /**
   * An event's (or a screen's) properties, copied into what JSON can hold as
   * the TypeScript core does. `None` for an event they cannot be copied for,
   * which is dropped and reported.
   */
  const encodeEvent = (
    operation: "capture" | "screen",
    name: string,
    properties: Record<string, unknown>,
  ): Option.Option<string> => {
    const json = EffectResult.flatMap(toJsonSafeProperties(properties), (copied) =>
      Option.match(EffectResult.getSuccess(encodeJson(copied)), {
        onNone: () => EffectResult.fail("cannot be encoded as JSON"),
        onSome: (encoded) => EffectResult.succeed(encoded),
      }),
    );
    if (EffectResult.isFailure(json)) {
      report({
        code: "ANALYTICS_EVENT_DROPPED",
        kind: "eviction",
        message: `Dropped "${name}": its properties ${json.failure}`,
        operation,
        retryable: false,
      });
      return Option.none();
    }
    return Option.some(json.success);
  };

  // A binary built before `captureAt` and `screenAt` has neither; an event the
  // facade held back then takes the time it is handed over at.
  const takesCaptureTime =
    P.isFunction(Reflect.get(native, "captureAt")) && P.isFunction(Reflect.get(native, "screenAt"));

  /**
   * Queues an encoded event (or screen) through a synchronous native call,
   * at `capturedAt` for one the facade held back. A native call that throws
   * is reported: capturing never throws.
   */
  const sendEvent = (
    operation: "capture" | "screen",
    name: string,
    propertiesJson: string,
    capturedAt: Option.Option<number>,
  ) => {
    const sent = EffectResult.try(() => {
      if (Option.isSome(capturedAt) && takesCaptureTime) {
        if (operation === "capture") native.captureAt(name, propertiesJson, capturedAt.value);
        else native.screenAt(name, propertiesJson, capturedAt.value);
        return;
      }
      if (operation === "capture") native.capture(name, propertiesJson);
      else native.screen(name, propertiesJson);
    });
    if (EffectResult.isFailure(sent)) {
      report({
        code: "ANALYTICS_EVENT_DROPPED",
        kind: "eviction",
        message: `Dropped "${name}": ${readNativeError(sent.failure).message}`,
        operation,
        retryable: false,
      });
    }
  };

  return {
    /**
     * Configures and starts the native client, also again after `shutdown()`
     * (a re-init). The listener is attached first, so what `start()`
     * announces reaches the atoms. The identity a new run loads has a newer
     * generation than anything of the previous run, so a read the previous
     * run left pending is never published. A failed start detaches the
     * listener again.
     */
    start: async (
      configuration: NativeClientConfiguration,
    ): Promise<Result<void, VoidhashError>> => {
      // An over-the-air bundle onto a build made for another contract would misread every
      // answer: nothing of it is started.
      const version = contractVersionOf(native);
      if (version !== NATIVE_CONTRACT_VERSION) {
        return Result.err(
          new VoidhashError(
            "FAILED_TO_INITIALIZE_VOIDHASH_CLIENT",
            `FAILED_TO_INITIALIZE_VOIDHASH_CLIENT: the app's native Voidhash module implements version ${version} of its contract, and this JavaScript bundle needs version ${NATIVE_CONTRACT_VERSION}. Make a new native build of the app with this version of @voidhash/react-native; an over-the-air update cannot change the native module.`,
          ),
        );
      }
      MutableRef.set(listening, true);
      const started = await call(FAILURES.start, async () => {
        native.setEventListener(handleEvent);
        native.configure(configuration);
        await native.start();
      });
      if (started.isErr()) stopListening();
      return started;
    },

    /**
     * Shuts the native client down; events it emits from then on are ignored.
     * The products go with it: a later run loads them for its own identity.
     */
    shutdown: async () => {
      const result = await call(FAILURES.shutdown, () => native.shutdown());
      stopListening();
      MutableRef.update(productsRevision, (revision) => revision + 1);
      cancelScheduledReload();
      MutableRef.set(productsLoad, Option.none());
      atomRegistry.set(productsAtom, NO_PRODUCTS);
      return result.map(toFlushResult);
    },

    getDistinctId: () => call(FAILURES.getDistinctId, () => native.getDistinctId()),

    /** Backs `identify()`: the switch, without the confirmation. */
    identify: async (externalUserId: string, profile: { email?: string; name?: string } = {}) =>
      (await switchIdentity(externalUserId, profile)).map(() => undefined),

    /** Backs `identifySync()`: the switch and whether the server confirmed it. */
    identifySync: async (externalUserId: string, profile: { email?: string; name?: string } = {}) =>
      (await switchIdentity(externalUserId, profile)).map((result): IdentifyResult => {
        const person = personOf(result);
        return result.status === "confirmed" && Option.isSome(person)
          ? { person: person.value, status: "confirmed" }
          : { person: Option.getOrNull(person), status: "deferred" };
      }),

    reset: () => switchToAnonymous(FAILURES.reset, () => native.reset()),
    signOut: () => switchToAnonymous(FAILURES.signOut, () => native.signOut()),

    /**
     * Backs `group()`. The native SDK checks the type and key (an invalid one
     * rejects `INVALID_ARGUMENT`), keeps the group with the identity and sends
     * the `$groupidentify`.
     */
    group: async (
      groupType: string,
      groupKey: string,
      properties: Option.Option<GroupProperties>,
    ): Promise<Result<void, VoidhashError>> => {
      if (Option.isNone(properties)) {
        return call(FAILURES.group, () => native.group(groupType, groupKey, undefined));
      }
      return Option.match(EffectResult.getSuccess(encodeJson(properties.value)), {
        onNone: () =>
          Promise.resolve(
            Result.err(
              new VoidhashError(
                "INVALID_ARGUMENT",
                "INVALID_ARGUMENT: group properties must be values JSON can hold",
              ),
            ),
          ),
        onSome: (json) => call(FAILURES.group, () => native.group(groupType, groupKey, json)),
      });
    },
    /**
     * Backs `setGroups()`. The native SDK replaces the held groups, checks
     * each type and id, and sends a `$groupidentify` only for what changed.
     */
    setGroups: async (groups: Groups): Promise<Result<void, VoidhashError>> => {
      const entries = R.filterMap(groups, (group) => {
        if (P.isNullish(group)) return EffectResult.failVoid;
        if (!P.isObject(group)) return EffectResult.succeed({ id: String(group), properties: {} });
        const { id, ...properties } = group;
        return EffectResult.succeed({ id: String(id), properties });
      });
      return Option.match(EffectResult.getSuccess(encodeJson(entries)), {
        onNone: () =>
          Promise.resolve(
            Result.err(
              new VoidhashError(
                "INVALID_ARGUMENT",
                "INVALID_ARGUMENT: group properties must be values JSON can hold",
              ),
            ),
          ),
        onSome: (json) => call(FAILURES.setGroups, () => native.setGroups(json)),
      });
    },
    resetGroups: () => call(FAILURES.resetGroups, () => native.resetGroups()),
    /** The groups the native client holds; none when it could not say. */
    getGroups: (): Readonly<Record<string, string>> =>
      Option.getOrElse(
        trySync("getGroups", () => native.getGroups()),
        () => ({}),
      ),

    setPersonAttributes: async (
      attributes: PersonAttributes,
    ): Promise<Result<void, VoidhashError>> => {
      const encoded = encodeAttributes(attributes);
      if (encoded.isErr()) return Result.err(encoded.error);
      return call(FAILURES.setPersonAttributes, () => native.setPersonAttributes(encoded.value));
    },

    setPersonAttributesSync: async (
      attributes: PersonAttributes,
    ): Promise<Result<SetPersonAttributesResult, VoidhashError>> => {
      const encoded = encodeAttributes(attributes);
      if (encoded.isErr()) return Result.err(encoded.error);
      return (
        await call(FAILURES.setPersonAttributesSync, () =>
          native.setPersonAttributesState(encoded.value),
        )
      ).map(toAttributesResult);
    },

    getCurrentPerson: async (options: { forceFetch?: boolean } = {}) =>
      (await readPerson(options.forceFetch ?? false)).map(toCurrentPerson),

    /** Answers an entitlement check from the person read, as the TypeScript core does. */
    hasPerk: async (perkSlug: PerkSlug, options: { forceFetch?: boolean } = {}) =>
      (await readPerson(options.forceFetch ?? false)).map((state): HasPerkResult => {
        const snapshot = toCurrentPerson(state);
        const grant = findActiveGrant(Option.fromNullOr(snapshot.person), perkSlug);
        return {
          ...Option.match(grant, { onNone: () => ({}), onSome: (found) => ({ grant: found }) }),
          hasAccess: Option.isSome(grant),
          isExpired: snapshot.isExpired,
          isStale: snapshot.isStale,
          reason: snapshot.reason,
        };
      }),

    resetCache: () => call(FAILURES.resetCache, () => native.resetPersonCache()),

    /**
     * Evaluates flags and stores the answer under the keys asked for, which
     * is where the hook that asked reads it, whatever the native side echoes.
     */
    getFeatureFlags: (flagKeys?: ReadonlyArray<string>) =>
      call(FAILURES.getFeatureFlags, async () => {
        const result = await native.getFeatureFlags(
          flagKeys === undefined ? undefined : [...flagKeys],
        );
        publishFlags(result, normalizeFeatureFlagKeys(flagKeys));
        return toFlags(result);
      }),

    getPaywallForLocation: async (location: string) => {
      const json = await call(FAILURES.getPaywallForLocation, () => native.getPaywall(location));
      return json.andThen((value) =>
        EffectResult.match(EffectResult.flatMap(decodeJson(value), decodePaywall), {
          onFailure: () =>
            Result.err(
              new VoidhashError(
                "FAILED_TO_GET_PAYWALL_FOR_LOCATION",
                `FAILED_TO_GET_PAYWALL_FOR_LOCATION: unreadable paywall for "${location}"`,
              ),
            ),
          onSuccess: (paywall) => Result.ok(paywall),
        }),
      );
    },

    /** Loads the products, sharing a load already running; see `loadProducts`. */
    loadProducts,

    /**
     * Buys a product. A cancelled sheet and a pending payment are results; a
     * native client that rejects them with `USER_CANCELLED` or
     * `PURCHASE_PENDING` is read the same way. A store refusal with a reason
     * is `FAILED_TO_PURCHASE` with that reason. A completed purchase, and an
     * offer the end user could not get (`INELIGIBLE_FOR_OFFER` or
     * `OFFER_UNAVAILABLE`), outdate the products: the offers they list may
     * have changed.
     */
    purchase: async (
      productSlug: string,
      purchaseOptions: NativePurchaseOptions,
    ): Promise<Result<StorePurchaseResult, VoidhashError>> => {
      const exit = await Effect.runPromiseExit(
        Effect.tryPromise({
          catch: (error) => error,
          try: () => native.purchase(productSlug, purchaseOptions),
        }),
      );
      if (Exit.isSuccess(exit)) {
        const result = toPurchaseResult(exit.value, (message) =>
          reportContractViolation("purchase", message),
        );
        if (Option.isNone(result)) {
          return Result.err(
            new VoidhashError(
              "FAILED_TO_PURCHASE",
              "FAILED_TO_PURCHASE: the native client reported a purchase without its transaction",
            ),
          );
        }
        if (result.value.status === "purchased") invalidateProducts();
        return Result.ok(result.value);
      }
      const error = Cause.squash(exit.cause);
      const failure = readNativeError(error);
      const code = Option.getOrElse(failure.code, () => "");
      if (code === "USER_CANCELLED") return Result.ok({ status: "cancelled" });
      if (code === "PURCHASE_PENDING") return Result.ok({ status: "pending" });
      if (code === "INELIGIBLE_FOR_OFFER" || code === "OFFER_UNAVAILABLE") invalidateProducts();
      const reason = R.get(PURCHASE_FAILURE_REASONS, code);
      if (Option.isSome(reason)) {
        return Result.err(
          new VoidhashError("FAILED_TO_PURCHASE", `FAILED_TO_PURCHASE: ${failure.message}`, {
            cause: error,
            reason: reason.value,
          }),
        );
      }
      return Result.err(toVoidhashError(error, FAILURES.purchase));
    },

    /**
     * Revalidates the store's purchase history and answers the refreshed
     * person (`null` when there is none), publishing it as a read does. A
     * restore outdates the products: what was restored can change the
     * offers the end user is eligible for.
     */
    // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK answer consumed by non-Effect app code.
    restorePurchases: async (): Promise<Result<Person | null, VoidhashError>> => {
      const restored = await call(FAILURES.restorePurchases, async () => {
        const state = await native.restorePurchases();
        publishPerson(state);
        return state;
      });
      if (restored.isOk()) invalidateProducts();
      return restored.map((state) => Option.getOrNull(personOf(state)));
    },

    syncPurchases: () => call(FAILURES.syncPurchases, () => native.syncPurchases()),
    reportTransaction: (transaction: NativeReportedTransaction, isRestore: boolean) =>
      call(FAILURES.reportTransaction, () => native.reportTransaction(transaction, isRestore)),

    /** Answers whether the consent was also stored for later launches. */
    setAnalyticsConsent: (consent: NativeAnalyticsConsent) =>
      call(FAILURES.setAnalyticsConsent, () => native.setAnalyticsConsent(consent)),
    /** The consent the native client has in effect; `None` when it could not say. */
    getAnalyticsConsent: (): Option.Option<AnalyticsConsent> =>
      Option.filter(
        trySync("getAnalyticsConsent", () => native.getAnalyticsConsent()),
        isAnalyticsConsent,
      ),
    /** Switches observer mode natively; a throw is reported, the facade's mode still switches. */
    setReadOnly: (readOnly: boolean) => {
      trySync("setReadOnly", () => native.setReadOnly(readOnly));
    },

    flush: async () => (await call(FAILURES.flush, () => native.flush())).map(toFlushResult),

    /** The active session id, or `undefined` when there is none. */
    // oxlint-disable-next-line effect/prefer-option-over-null -- mirrors the facade's `getSessionId()` answer.
    getSessionId: (): string | undefined =>
      Option.getOrUndefined(
        Option.filter(
          trySync("getSessionId", () => native.getSessionId()),
          (sessionId) => sessionId !== "",
        ),
      ),

    capture: (eventName: string, properties: Record<string, unknown> = {}) =>
      Option.map(encodeEvent("capture", eventName, properties), (json) =>
        sendEvent("capture", eventName, json, Option.none()),
      ),
    screen: (name: string, properties: Record<string, unknown> = {}) =>
      Option.map(encodeEvent("screen", name, properties), (json) =>
        sendEvent("screen", name, json, Option.none()),
      ),
    /**
     * Copies an event's (or a screen's) properties now and answers what
     * queues it later, given the time it was captured at: for an event the
     * facade holds back until an identity change switched the identity.
     * `None` for an event whose properties cannot be copied, already reported.
     */
    holdEvent: (
      operation: "capture" | "screen",
      name: string,
      properties: Record<string, unknown>,
    ): Option.Option<(capturedAt: number) => void> =>
      Option.map(
        encodeEvent(operation, name, properties),
        (json) => (capturedAt: number) => sendEvent(operation, name, json, Option.some(capturedAt)),
      ),
    /** The distinct id in effect, as last announced; `None` before the first `start()`. */
    currentDistinctId: (): Option.Option<string> =>
      Option.map(MutableRef.get(currentIdentity), (identity) => identity.distinctId),

    // oxlint-disable-next-line effect/prefer-option-over-null -- mirrors the Nitro contract, where an optional is `undefined`.
    showManageSubscriptions: (productSlug: string | undefined) =>
      call(FAILURES.showManageSubscriptions, () => native.showManageSubscriptions(productSlug)),
    // oxlint-disable-next-line effect/prefer-option-over-null -- mirrors the Nitro contract, where an optional is `undefined`.
    presentCodeRedemption: (code: string | undefined) =>
      call(FAILURES.presentCodeRedemption, () => native.presentCodeRedemption(code)),
    getStorefront: async () =>
      (await call(FAILURES.getStorefront, () => native.getStorefront())).map(
        // oxlint-disable-next-line effect/prefer-option-over-null -- mirrors the Nitro contract, where an optional is `undefined`.
        (storefront: NativeStorefront | undefined) =>
          storefront === undefined
            ? undefined
            : {
                countryCode: storefront.countryCode,
                ...(storefront.currencyCode === undefined
                  ? {}
                  : { currencyCode: storefront.currencyCode }),
              },
      ),
    canMakePayments: () => call(FAILURES.canMakePayments, () => native.canMakePayments()),

    appStoreBeginRefundRequest: (transactionId: string) =>
      call(FAILURES.appStoreBeginRefundRequest, (): Promise<RefundRequestStatus> =>
        native.appStoreBeginRefundRequest(transactionId),
      ),
    /**
     * The group's statuses. One whose renewal info cannot be read breaks the
     * contract: it is left out and reported.
     */
    appStoreSubscriptionStatus: async (groupId: string) =>
      (
        await call(FAILURES.appStoreSubscriptionStatus, () =>
          native.appStoreSubscriptionStatus(groupId),
        )
      ).map((statuses): ReadonlyArray<AppStoreSubscriptionStatus> =>
        Arr.filterMap(statuses, (status) => {
          const renewalInfo = decodeAppStoreRenewalInfo(status.renewalInfoJson);
          if (Option.isNone(renewalInfo)) {
            reportContractViolation(
              "appStore.subscriptionStatus",
              `The renewal info of transaction ${status.transaction.id} could not be read`,
            );
            return EffectResult.failVoid;
          }
          return EffectResult.succeed({
            renewalInfo: renewalInfo.value,
            state: status.state,
            transaction: toTransaction(status.transaction, (message) =>
              reportContractViolation("appStore.subscriptionStatus", message),
            ),
          });
        }),
      ),
    appStoreCurrentEntitlements: async () =>
      (
        await call(FAILURES.appStoreCurrentEntitlements, () => native.appStoreCurrentEntitlements())
      ).map((transactions) =>
        transactions.map((transaction) =>
          toTransaction(transaction, (message) =>
            reportContractViolation("appStore.currentEntitlements", message),
          ),
        ),
      ),
    appStoreAppTransaction: async () =>
      (await call(FAILURES.appStoreAppTransaction, () => native.appStoreAppTransaction())).andThen(
        (json): Result<AppTransaction, VoidhashError> =>
          Option.match(decodeAppTransaction(json), {
            onNone: () =>
              Result.err(
                new VoidhashError(
                  "FAILED_TO_GET_APP_TRANSACTION",
                  "FAILED_TO_GET_APP_TRANSACTION: the native client sent an app transaction this SDK cannot read",
                ),
              ),
            onSome: (appTransaction) => Result.ok(appTransaction),
          }),
      ),

    googlePlayShowInAppMessages: async () =>
      (
        await call(FAILURES.googlePlayShowInAppMessages, () => native.googlePlayShowInAppMessages())
      ).map((result): GooglePlayInAppMessageResult =>
        result.status === "subscriptionStatusUpdated" && result.purchaseToken !== undefined
          ? { purchaseToken: result.purchaseToken, status: "subscriptionStatusUpdated" }
          : { status: "noActionNeeded" },
      ),
    googlePlayQueryPurchases: async (includeSuspended: boolean) =>
      (
        await call(FAILURES.googlePlayQueryPurchases, () =>
          native.googlePlayQueryPurchases(includeSuspended),
        )
      ).map((transactions) =>
        transactions.map((transaction) =>
          toTransaction(transaction, (message) =>
            reportContractViolation("googlePlay.queryPurchases", message),
          ),
        ),
      ),
    googlePlayIsFeatureSupported: (feature: string) =>
      call(FAILURES.googlePlayIsFeatureSupported, () =>
        native.googlePlayIsFeatureSupported(feature),
      ),

    /**
     * Resolves with how the flow ended and rejects with a `VoidhashError` when
     * it could not be presented. A `FLOW_*` code the native side gives is
     * kept; a client that is not started is `FLOW_UNAVAILABLE`.
     *
     * The native coordinator runs the flow: it calls back only for the
     * actions named here, and answers a rejected call, a slow one and one
     * whose flow has ended itself.
     * A flow that ended in a purchase or a restore outdates the products, as
     * `purchase()` and `restorePurchases()` do: the native client reports
     * neither as a transaction update.
     */
    presentFlow: async (
      location: string,
      options: PresentFlowOptions = {},
    ): Promise<FlowResult> => {
      const handlers = options.actions ?? {};
      const onAction = async (name: string, argsJson: string) => {
        const handler = handlers[name];
        if (handler === undefined) {
          throw new VoidhashError("INVALID_ARGUMENT", `no handler for app action "${name}"`);
        }
        const reply = await handler(decodeFlowValues(argsJson));
        return encodeFlowValues(reply ?? {});
      };
      const exit = await Effect.runPromiseExit(
        Effect.tryPromise({
          catch: (error) => error,
          try: () =>
            native.presentFlow(
              location,
              {
                actions: R.keys(handlers),
                inputJson: encodeFlowValues(options.input ?? {}),
                ...(options.revision === undefined ? {} : { revision: options.revision }),
              },
              onAction,
            ),
        }),
      );
      if (Exit.isSuccess(exit)) {
        const parsed = parseFlowResult(exit.value);
        if (EffectResult.isFailure(parsed)) throw parsed.failure;
        if (parsed.success.outcome === "purchased" || parsed.success.outcome === "restored") {
          invalidateProducts();
        }
        return parsed.success;
      }
      const failure = readNativeError(Cause.squash(exit.cause));
      const code = Option.getOrElse(failure.code, () => "");
      if (NOT_STARTED_CODES.includes(code)) {
        throw flowError("FLOW_UNAVAILABLE", new NotInitializedError().message);
      }
      throw isFlowErrorCode(code)
        ? new VoidhashError(code, failure.message)
        : flowError("FLOW_PRESENTATION_FAILED", failure.message);
    },
    updateFlowInput: (values: FlowValues) =>
      call(FAILURES.updateFlowInput, () => native.updateFlowInput(encodeFlowValues(values))),
    dismissFlow: () => call(FAILURES.dismissFlow, () => native.dismissFlow()),
  } as const;
};

/** The facade-facing client over one native hybrid. */
export type NativeClientAdapter = ReturnType<typeof makeNativeClientAdapter>;

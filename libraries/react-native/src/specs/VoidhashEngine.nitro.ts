import type { HybridObject } from "react-native-nitro-modules";

/**
 * Embedded native engine: the Swift/Kotlin Voidhash clients exposed as the React
 * Native SDK's data-plane transport.
 *
 * When this hybrid is available the SDK routes its `/api/v1/sdk/*` calls through
 * the bare-native clients instead of the TypeScript networking stack — headers,
 * environment mode and transport are built natively, exactly like a pure-native
 * integration. Identity stays JS-owned: every operation takes the distinct id
 * explicitly so both sides can never diverge.
 *
 * Complex payloads cross as JSON strings; absent values are the string `"null"`.
 */
export interface VoidhashEngine extends HybridObject<{
  ios: "swift";
  android: "kotlin";
}> {
  /**
   * Configures the underlying client. `optionsJson` is
   * `{ baseUrl?, ingestUrl?, debug?, enabled?, readOnly?, dev? }`.
   */
  configure(publishableKey: string, optionsJson: string): void;
  /**
   * Mirrors the JS observer-mode decision into the native client so the
   * `x-observer-mode` header it sends never drifts from `client.setReadOnly()`.
   */
  setReadOnly(readOnly: boolean): void;
  /** Fetches the runtime schema. Never touches the store — data plane only. */
  fetchSchema(distinctId: string): Promise<string>;
  /** Fetches the person snapshot for [distinctId]; resolves `"null"` when absent. */
  fetchPerson(distinctId: string, forceFetch: boolean): Promise<string>;
  /** Aliases [distinctId] onto `{ distinctId, email?, name? }` (JSON) and returns the merged person. */
  identify(distinctId: string, bodyJson: string): Promise<string>;
  /** Writes person traits (`{ email?, name?, traits }` JSON) and returns the updated person. */
  setPersonAttributes(distinctId: string, attributesJson: string): Promise<string>;
  /** Evaluates feature flags for [distinctId]; `[keys]` is a JSON array of flag keys. */
  evaluateFlags(distinctId: string, flagKeysJson: string): Promise<string>;
  /** Resolves the paywall for [location]; resolves `"null"` when nothing is showing. */
  resolvePaywall(distinctId: string, locationSlug: string): Promise<string>;
  /**
   * Syncs a store transaction; `requestJson` is
   * `{ distinctId, request: <sync-transaction body> }`.
   */
  syncTransaction(distinctId: string, requestJson: string): Promise<boolean>;
  /** Records a development purchase; `requestJson` is `{ distinctId, request: <dev-purchase body> }`. */
  developmentPurchase(distinctId: string, requestJson: string): Promise<boolean>;
  /** Adopts an externally supplied runtime schema (preview/testing escape hatch). */
  injectInternalSchema(schemaJson: string): Promise<void>;
}

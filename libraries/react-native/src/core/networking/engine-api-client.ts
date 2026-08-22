import { Effect, Layer } from "effect";

import type { VoidhashEngine as VoidhashEngineSpec } from "../../specs/VoidhashEngine.nitro";
import type { RuntimeSchema } from "../schema/runtime";
import {
  ApiClient,
  bindReactNativeSdkClient,
  type ReactNativeDevelopmentPurchaseRequest,
  type ReactNativeFeatureFlagsResponse,
  type ReactNativeSyncTransactionRequest,
} from "./api-client";

/** The engine surfaces a missing person as `"null"`; TS consumers expect the tagged error. */
const PERSON_NOT_FOUND = {
  _tag: "ApiSdkPersonNotFoundErrorJsonEncoding",
  message: "Person not found.",
} as const;

const parseJson = <Value>(json: string): Value => JSON.parse(json) as Value;

interface EngineHeaders {
  readonly "x-distinct-id": string;
}

/** The engine transport's service surface, structurally equal to the bound generated client. */
export type EngineApiClientShape = ReturnType<typeof bindReactNativeSdkClient>;

/**
 * Builds the `ApiClient` service surface on top of the embedded native engine
 * (see `src/specs/VoidhashEngine.nitro.ts`).
 *
 * Headers are accepted for signature compatibility but ignored: the native client builds
 * the wire headers itself — including environment mode and debug flags, exactly like a
 * pure-native integration. The distinct id travels per request so identity stays owned by
 * the TypeScript layer.
 */
export const createEngineApiClient = (engine: VoidhashEngineSpec): EngineApiClientShape => {
  const sdk = {
    getSchema: (request: { headers: EngineHeaders }) =>
      Effect.tryPromise(() =>
        engine
          .fetchSchema(request.headers["x-distinct-id"])
          .then((schema) => parseJson<RuntimeSchema>(schema)),
      ),
    evaluateFeatureFlags: (request: {
      headers: EngineHeaders;
      payload: { flagKeys?: string[] };
    }) =>
      Effect.tryPromise((): Promise<ReactNativeFeatureFlagsResponse> => {
        return engine
          .evaluateFlags(
            request.headers["x-distinct-id"],
            JSON.stringify(request.payload.flagKeys ?? []),
          )
          .then((flags) => ({
            flags: parseJson<Array<{ enabled: boolean; key: string; variantKey: string | null }>>(
              flags,
            ).map((flag) => ({ ...flag, payload: null })),
          }));
      }),
    getPerson: (request: { headers: EngineHeaders }) =>
      Effect.tryPromise(() => {
        return engine.fetchPerson(request.headers["x-distinct-id"], true).then((person) =>
          person === "null" ? null : parseJson(person),
        );
      }).pipe(
        // A brand-new distinct id legitimately has no server-side person yet; the
        // TypeScript transport surfaces that as the tagged 404, so mirror it here.
        Effect.flatMap((person) =>
          person === null ? Effect.fail(PERSON_NOT_FOUND) : Effect.succeed(person),
        ),
      ),
    identify: (request: {
      headers: EngineHeaders;
      payload: { distinctId: string; email?: string | undefined; name?: string | undefined };
    }) =>
      Effect.tryPromise(() =>
        engine
          .identify(request.headers["x-distinct-id"], JSON.stringify(request.payload))
          .then((person) => parseJson(person)),
      ),
    resolvePaywall: (request: {
      headers: EngineHeaders;
      payload: { locationSlug: string };
    }) =>
      Effect.tryPromise(() => {
        return engine
          .resolvePaywall(request.headers["x-distinct-id"], request.payload.locationSlug)
          .then((paywall) => (paywall === "null" ? null : parseJson(paywall)));
      }),
    syncPersonAttributes: (request: {
      headers: EngineHeaders;
      payload: Record<string, unknown>;
    }) =>
      Effect.tryPromise(() => {
        return engine
          .setPersonAttributes(
            request.headers["x-distinct-id"],
            JSON.stringify(request.payload),
          )
          .then((person) => (person === "null" ? null : parseJson(person)));
      }),
    syncTransaction: (request: {
      headers: EngineHeaders;
      payload: ReactNativeSyncTransactionRequest;
    }) =>
      Effect.tryPromise(async () => {
        const accepted = await engine.syncTransaction(
          request.headers["x-distinct-id"],
          JSON.stringify({ request: request.payload }),
        );
        return { accepted };
      }),
    developmentPurchase: (request: {
      headers: EngineHeaders;
      payload: ReactNativeDevelopmentPurchaseRequest;
    }) =>
      Effect.tryPromise(() =>
        engine.developmentPurchase(
          request.headers["x-distinct-id"],
          JSON.stringify({ request: request.payload }),
        ),
      ),
  };

  // The engine transport satisfies the same structural surface the bound generated client
  // exposes; payloads are plain JSON on both sides of the Nitro boundary.
  return { sdk } as unknown as EngineApiClientShape;
};

/** `ApiClient` backed by the embedded native engine instead of the TypeScript fetch stack. */
export const engineApiClientLayer = (engine: VoidhashEngineSpec) =>
  Layer.succeed(ApiClient, createEngineApiClient(engine));

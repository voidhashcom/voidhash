import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import {
  type ApiSdkPersonNotFoundErrorJsonEncoding,
  type EvaluateFeatureFlagsBody,
  type SdkIdentifyBody,
  type SdkPersonJsonEncoding,
  type SdkResolvePaywall200,
  type SdkSyncPersonAttributesBody,
  VoidhashCoreClientError,
} from "@voidhash/generated-clients";
import { HttpClientRequest, HttpClientResponse } from "effect/unstable/http";

import type { VoidhashEngine as VoidhashEngineSpec } from "../../specs/VoidhashEngine.nitro";
import { RuntimeSchemaValue } from "../schema/runtime";
import {
  ApiClient,
  bindReactNativeSdkClient,
  type ReactNativeDevelopmentPurchaseRequest,
  type ReactNativeFeatureFlagsResponse,
  type ReactNativeSyncTransactionRequest,
} from "./api-client";
import * as Schema from "effect/Schema";
const effectEncodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);
const effectDecodeJson = Schema.decodeUnknownSync(Schema.UnknownFromJsonString);
const booleanValue = Schema.declare(P.isBoolean);
const engineFeatureFlagsFromJson = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      enabled: booleanValue,
      key: Schema.String,
      variantKey: Schema.NullOr(Schema.String),
    }),
  ),
);

/** The engine surfaces a missing person as `"null"`; TS consumers expect the tagged error. */
const PERSON_NOT_FOUND_DATA: ApiSdkPersonNotFoundErrorJsonEncoding = {
  _tag: "Api/SdkPersonNotFoundError",
  message: "Person not found.",
};

const personNotFoundError = () =>
  VoidhashCoreClientError(
    "ApiSdkPersonNotFoundErrorJsonEncoding",
    PERSON_NOT_FOUND_DATA,
    HttpClientResponse.fromWeb(
      HttpClientRequest.get("voidhash-native://person"),
      new Response(null, { status: 404 }),
    ),
  );

const parseJson = <Value>(json: string): Value =>
  Schema.decodeUnknownSync(Schema.declare((_value: unknown): _value is Value => true))(
    effectDecodeJson(json),
  );

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
          .then((schema) =>
            Schema.decodeUnknownSync(Schema.fromJsonString(RuntimeSchemaValue))(schema),
          ),
      ).pipe(Effect.orDie),
    evaluateFeatureFlags: (request: {
      headers: EngineHeaders;
      payload: EvaluateFeatureFlagsBody;
    }) =>
      Effect.tryPromise((): Promise<ReactNativeFeatureFlagsResponse> => {
        return engine
          .evaluateFlags(
            request.headers["x-distinct-id"],
            effectEncodeJson(request.payload.flagKeys ?? []),
          )
          .then((flags) => ({
            flags: Schema.decodeUnknownSync(engineFeatureFlagsFromJson)(flags).map((flag) => ({
              ...flag,
              payload: null,
              variantKey: Option.fromNullishOr(flag.variantKey),
            })),
          }));
      }).pipe(Effect.orDie),
    getPerson: (request: { headers: EngineHeaders }) =>
      Effect.tryPromise(() => {
        return engine
          .fetchPerson(request.headers["x-distinct-id"], true)
          .then((person) =>
            person === "null"
              ? Option.none()
              : Option.some(parseJson<SdkPersonJsonEncoding>(person)),
          );
      }).pipe(
        Effect.orDie,
        // A brand-new distinct id legitimately has no server-side person yet; the
        // TypeScript transport surfaces that as the tagged 404, so mirror it here.
        Effect.flatMap((person) =>
          Option.isNone(person) ? Effect.fail(personNotFoundError()) : Effect.succeed(person.value),
        ),
      ),
    identify: (request: { headers: EngineHeaders; payload: SdkIdentifyBody }) =>
      Effect.tryPromise(() =>
        engine
          .identify(request.headers["x-distinct-id"], effectEncodeJson(request.payload))
          .then((person) => parseJson<SdkPersonJsonEncoding>(person)),
      ).pipe(Effect.orDie),
    resolvePaywall: (request: { headers: EngineHeaders; payload: { locationSlug: string } }) =>
      Effect.tryPromise(() => {
        return engine
          .resolvePaywall(request.headers["x-distinct-id"], request.payload.locationSlug)
          .then((paywall) =>
            paywall === "null" ? null : parseJson<Exclude<SdkResolvePaywall200, null>>(paywall),
          );
      }).pipe(Effect.orDie),
    syncPersonAttributes: (request: {
      headers: EngineHeaders;
      payload: SdkSyncPersonAttributesBody;
    }) =>
      Effect.tryPromise(() => {
        return engine
          .setPersonAttributes(request.headers["x-distinct-id"], effectEncodeJson(request.payload))
          .then((person) =>
            person === "null"
              ? Option.none()
              : Option.some(parseJson<SdkPersonJsonEncoding>(person)),
          );
      }).pipe(
        Effect.orDie,
        Effect.flatMap((person) =>
          Option.isNone(person) ? Effect.fail(personNotFoundError()) : Effect.succeed(person.value),
        ),
      ),
    syncTransaction: (request: {
      headers: EngineHeaders;
      payload: ReactNativeSyncTransactionRequest;
    }) =>
      Effect.tryPromise(async () => {
        const accepted = await engine.syncTransaction(
          request.headers["x-distinct-id"],
          effectEncodeJson({ request: request.payload }),
        );
        return { accepted };
      }).pipe(Effect.orDie),
    developmentPurchase: (request: {
      headers: EngineHeaders;
      payload: ReactNativeDevelopmentPurchaseRequest;
    }) =>
      Effect.tryPromise(() =>
        engine.developmentPurchase(
          request.headers["x-distinct-id"],
          effectEncodeJson({ request: request.payload }),
        ),
      ).pipe(
        Effect.orDie,
        Effect.map((accepted) => ({ accepted, warning: null })),
      ),
  };

  // The engine transport satisfies the same structural surface the bound generated client
  // exposes; payloads are plain JSON on both sides of the Nitro boundary.
  return { sdk };
};

/** `ApiClient` backed by the embedded native engine instead of the TypeScript fetch stack. */
export const engineApiClientLayer = (engine: VoidhashEngineSpec) =>
  Layer.succeed(ApiClient, createEngineApiClient(engine));

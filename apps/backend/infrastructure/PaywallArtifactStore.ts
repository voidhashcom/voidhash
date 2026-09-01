import {
  PaywallArtifactStore,
  PaywallArtifactStoreError,
  type PaywallArtifactStoreShape,
} from "@voidhash/core/services/paywallDeploys/PaywallArtifactStore";
import { causeMessage } from "@voidhash/lib/lang";
import * as Cloudflare from "alchemy/Cloudflare";
import type { RuntimeContext } from "alchemy/RuntimeContext";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

export type CloudflareR2Bucket = Effect.Success<Cloudflare.R2.ReadWriteBucketClient["raw"]>;

/** Creates the artifact-store port from an already-resolved R2 binding. */
export const makePaywallArtifactStore = (
  raw: CloudflareR2Bucket,
  bucketName: string,
): PaywallArtifactStoreShape => {
  const tryR2 = <T>(operation: string, run: () => Promise<T>) =>
    Effect.tryPromise({
      try: run,
      catch: (error) =>
        new PaywallArtifactStoreError({
          cause: causeMessage(error),
          message: `paywall artifact ${operation} failed`,
        }),
    });

  const putOptions = (contentType: Option.Option<string>) =>
    Option.match(contentType, {
      onNone: () => undefined,
      onSome: (value) => ({ httpMetadata: { contentType: value } }),
    });

  return {
    bucketName,
    putObject: ({ key, body, contentType }) =>
      tryR2("put", () => raw.put(key, body, putOptions(contentType))).pipe(
        Effect.asVoid,
      ),
    getObject: (key) =>
      Effect.gen(function* () {
        const object = yield* tryR2("get", () => raw.get(key));
        if (object === null) return Option.none();
        const buffer = yield* tryR2("get", () => object.arrayBuffer());
        return Option.some({
          body: new Uint8Array(buffer),
          contentType: Option.fromNullishOr(object.httpMetadata?.contentType),
        });
      }),
    head: (key) =>
      Effect.gen(function* () {
        const object = yield* tryR2("head", () => raw.head(key));
        if (object === null) return Option.none();
        return Option.some({ size: object.size });
      }),
  };
};

/**
 * Cloudflare R2 adapter for the core {@link PaywallArtifactStore} port.
 *
 * Must be called from a Worker's init Effect: `R2.ReadWriteBucket` registers
 * the `r2_bucket` Worker binding at plan time, and yielding
 * `bucket.bucketName` registers the physical bucket name as an env binding the
 * runtime accessor reads back. Both registrations happen during plan
 * evaluation.
 *
 * The returned Layer is built per request (alongside the rest of the backend
 * infra graph) and keeps Alchemy's `RuntimeContext` requirement, so the store
 * can only materialize inside Worker runtime code — where the binding and the
 * bucket-name env var actually exist. The store methods themselves are
 * requirement-free (the port's contract): the raw runtime bucket is resolved
 * once at layer build and every R2 failure is wrapped into
 * {@link PaywallArtifactStoreError}.
 *
 * @example Wire the store in a Worker init Effect
 * ```ts
 * const PaywallArtifactStoreLive = yield* makePaywallArtifactStoreLive(
 *   yield* PaywallArtifactsBucket,
 * );
 * ```
 */
export const makePaywallArtifactStoreLive = (
  bucket: Cloudflare.R2.Bucket,
): Effect.Effect<
  Layer.Layer<PaywallArtifactStore, never, RuntimeContext>,
  never,
  Cloudflare.R2.ReadWriteBucket
> =>
  Effect.gen(function* () {
    const client = yield* Cloudflare.R2.ReadWriteBucket(bucket);
    // `yield*` on an Output returns a lazy accessor: at plan time this call
    // registers the bucket name on the Worker's env; the accessor itself only
    // resolves the value when run (below, inside the runtime-only layer build).
    const bucketName = yield* bucket.bucketName;

    return Layer.effect(
      PaywallArtifactStore,
      Effect.fn("makePaywallArtifactStoreLive")(function* () {
        // The native `R2Bucket` runtime object rather than the Effect wrapper:
        // its R2Object properties (`httpMetadata`, `size`) live on workerd
        // prototypes, which the wrapper's object spread would lose.
        const raw = yield* client.raw;
        const name = yield* bucketName;

        return makePaywallArtifactStore(raw, name);
      })(),
    );
  });

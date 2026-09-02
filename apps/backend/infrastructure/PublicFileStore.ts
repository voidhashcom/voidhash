import {
  PublicFileStore,
  PublicFileStoreError,
  type PublicFileStoreShape,
} from "@voidhash/core/services/storage/PublicFileStore";
import { causeMessage } from "@voidhash/lib/lang";
import * as Cloudflare from "alchemy/Cloudflare";
import type { RuntimeContext } from "alchemy/RuntimeContext";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

export type CloudflarePublicR2Bucket = Effect.Success<Cloudflare.R2.ReadWriteBucketClient["raw"]>;

/** R2 `put` options for an optional content type — omitted entirely when absent. */
const putOptions = (contentType: Option.Option<string>) =>
  Option.match(contentType, {
    onNone: () => undefined,
    onSome: (value) => ({ httpMetadata: { contentType: value } }),
  });

/** Creates the public-file port from an already-resolved R2 binding. */
export const makePublicFileStore = (
  raw: CloudflarePublicR2Bucket,
  publicBaseUrl: string,
): PublicFileStoreShape => {
  const tryR2 = <T>(operation: string, run: () => Promise<T>) =>
    Effect.tryPromise({
      try: run,
      catch: (error) =>
        new PublicFileStoreError({
          cause: causeMessage(error),
          message: `public file ${operation} failed`,
        }),
    });

  return {
    publicBaseUrl,
    publicUrl: (key) => `${publicBaseUrl}/files/${key}`,
    putObject: ({ key, body, contentType }) =>
      tryR2("put", () => raw.put(key, body, putOptions(contentType))).pipe(Effect.asVoid),
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
    deleteObject: (key) => tryR2("delete", () => raw.delete(key)).pipe(Effect.asVoid),
  };
};

/**
 * Cloudflare R2 adapter for the core {@link PublicFileStore} port.
 *
 * Mirrors the paywall artifact-store adapter: must be called from a Worker's
 * init Effect so `R2.ReadWriteBucket` registers the `r2_bucket`
 * Worker binding at plan time. The returned Layer is built per request and
 * keeps Alchemy's `RuntimeContext` requirement, so the store only materializes
 * inside Worker runtime code where the binding exists. The raw runtime bucket
 * is resolved once at layer build and every R2 failure is wrapped into
 * {@link PublicFileStoreError}.
 *
 * `publicBaseUrl` is this worker's public origin — the `GET /files/*` serving
 * route lives here — so stored objects resolve at `${publicBaseUrl}/files/${key}`.
 *
 * @example Wire the store in a Worker init Effect
 * ```ts
 * const PublicFileStoreLive = yield* makePublicFileStoreLive(
 *   yield* PublicFileStorageBucket,
 *   publicBaseUrl,
 * );
 * ```
 */
export const makePublicFileStoreLive = (
  bucket: Cloudflare.R2.Bucket,
  publicBaseUrl: string,
): Effect.Effect<
  Layer.Layer<PublicFileStore, never, RuntimeContext>,
  never,
  Cloudflare.R2.ReadWriteBucket
> =>
  Effect.gen(function* () {
    const client = yield* Cloudflare.R2.ReadWriteBucket(bucket);

    return Layer.effect(
      PublicFileStore,
      Effect.fn("makePublicFileStoreLive")(function* () {
        // The native `R2Bucket` runtime object rather than the Effect wrapper:
        // its R2Object properties (`httpMetadata`) live on workerd prototypes,
        // which the wrapper's object spread would lose.
        const raw = yield* client.raw;

        return makePublicFileStore(raw, publicBaseUrl);
      })(),
    );
  });

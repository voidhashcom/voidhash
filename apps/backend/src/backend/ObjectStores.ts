import {
  PaywallArtifactStore,
  PaywallArtifactStoreError,
} from "@voidhash/core/services/paywallDeploys/PaywallArtifactStore";
import {
  PublicFileStore,
  PublicFileStoreError,
} from "@voidhash/core/services/storage/PublicFileStore";
import { ObjectStore, ObjectStoreError } from "@voidhash/platform/ObjectStore";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import {
  S3ObjectStoreLive,
  type S3ObjectStoreConfig,
} from "@voidhash/platform-selfhost/ObjectStore";
import { Effect, Layer, Option } from "effect";

const objectStoreCause = (cause: unknown): string =>
  cause instanceof ObjectStoreError
    ? `${cause.operation} ${cause.bucketName}/${cause.key}: ${cause.cause}`
    : String(cause);

const artifactError = (operation: string, cause: unknown) =>
  new PaywallArtifactStoreError({
    cause: objectStoreCause(cause),
    message: `Failed to ${operation} a paywall artifact`,
  });

const publicFileError = (operation: string, cause: unknown) =>
  new PublicFileStoreError({
    cause: objectStoreCause(cause),
    message: `Failed to ${operation} a public file`,
  });

/** S3-backed paywall artifact store bridge for the backend domain port. */
export const makePaywallArtifactStoreLive = (
  config: S3ObjectStoreConfig,
): Layer.Layer<PaywallArtifactStore, never, PlatformRuntime> =>
  Layer.effect(
    PaywallArtifactStore,
    Effect.gen(function* () {
      const store = yield* ObjectStore;
      const runtime = yield* PlatformRuntime;
      const run = <A>(effect: Effect.Effect<A, unknown, PlatformRuntime>, operation: string) =>
        effect.pipe(
          Effect.provideService(PlatformRuntime, runtime),
          Effect.mapError((cause) => artifactError(operation, cause)),
        );
      return {
        bucketName: store.bucketName,
        getObject: (key: string) =>
          run(store.get(key), "read").pipe(
            Effect.map(Option.match({ onNone: () => null, onSome: (value) => value })),
          ),
        head: (key: string) =>
          run(store.head(key), "inspect").pipe(
            Effect.map(
              Option.match({
                onNone: () => null,
                onSome: ({ size }) => ({ size }),
              }),
            ),
          ),
        putObject: (input) => run(store.put(input), "write"),
      };
    }),
  ).pipe(Layer.provide(S3ObjectStoreLive(config)));

/** S3-backed public file store bridge for the backend domain port. */
export const makePublicFileStoreLive = (
  config: S3ObjectStoreConfig,
  publicBaseUrl: string,
): Layer.Layer<PublicFileStore, never, PlatformRuntime> =>
  Layer.effect(
    PublicFileStore,
    Effect.gen(function* () {
      const store = yield* ObjectStore;
      const runtime = yield* PlatformRuntime;
      const run = <A>(effect: Effect.Effect<A, unknown, PlatformRuntime>, operation: string) =>
        effect.pipe(
          Effect.provideService(PlatformRuntime, runtime),
          Effect.mapError((cause) => publicFileError(operation, cause)),
        );
      const base = publicBaseUrl.replace(/\/$/, "");
      return {
        deleteObject: (key: string) => run(store.delete(key), "delete"),
        getObject: (key: string) =>
          run(store.get(key), "read").pipe(
            Effect.map(Option.match({ onNone: () => null, onSome: (value) => value })),
          ),
        publicBaseUrl: base,
        publicUrl: (key: string) => `${base}/files/${key}`,
        putObject: (input) => run(store.put(input), "write"),
      };
    }),
  ).pipe(Layer.provide(S3ObjectStoreLive(config)));

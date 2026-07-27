import { S3 } from "@effect-aws/client-s3";
import {
  ObjectStore,
  ObjectStoreError,
  type ObjectStoreShape,
} from "@voidhash/platform/ObjectStore";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { Effect, Layer, Option, Redacted } from "effect";

/** S3-compatible connection and bucket parameters. */
export interface S3ObjectStoreConfig {
  readonly bucketName: string;
  readonly region: string;
  readonly endpoint?: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: Redacted.Redacted<string>;
  readonly forcePathStyle?: boolean;
}

const storeError = (
  config: S3ObjectStoreConfig,
  key: string,
  operation: string,
  cause: unknown,
) =>
  new ObjectStoreError({
    bucketName: config.bucketName,
    key,
    operation,
    cause: String(cause),
  });

const isNotFound = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const tagged = error as { readonly _tag?: unknown };
  return tagged._tag === "NoSuchKey" || tagged._tag === "NotFound";
};

const makeStore = (
  config: S3ObjectStoreConfig,
  client: S3.Type,
): ObjectStoreShape => ({
  bucketName: config.bucketName,
  put: ({ key, body, contentType, cacheControl }) =>
    PlatformRuntime.pipe(
      Effect.andThen(
        client.putObject({
          Bucket: config.bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: cacheControl,
        }),
      ),
      Effect.asVoid,
      Effect.mapError((cause) => storeError(config, key, "put", cause)),
    ),
  get: (key) =>
    PlatformRuntime.pipe(
      Effect.andThen(client.getObject({ Bucket: config.bucketName, Key: key })),
      Effect.flatMap((output) => {
        const stream = output.Body;
        if (!stream) {
          return Effect.fail(storeError(config, key, "get", "response body is missing"));
        }
        return Effect.tryPromise({
          try: () => stream.transformToByteArray(),
          catch: (cause) => storeError(config, key, "get", cause),
        }).pipe(
          Effect.map((body) =>
            Option.some({
              body,
              contentType: output.ContentType ?? null,
              etag: output.ETag ?? null,
              size: output.ContentLength ?? body.byteLength,
            }),
          ),
        );
      }),
      Effect.catch((cause) =>
        isNotFound(cause)
          ? Effect.succeedNone
          : Effect.fail(
              cause instanceof ObjectStoreError
                ? cause
                : storeError(config, key, "get", cause),
            ),
      ),
    ),
  head: (key) =>
    PlatformRuntime.pipe(
      Effect.andThen(client.headObject({ Bucket: config.bucketName, Key: key })),
      Effect.map((output) =>
        Option.some({
          contentType: output.ContentType ?? null,
          etag: output.ETag ?? null,
          size: output.ContentLength ?? 0,
        }),
      ),
      Effect.catch((cause) =>
        isNotFound(cause)
          ? Effect.succeedNone
          : Effect.fail(storeError(config, key, "head", cause)),
      ),
    ),
  delete: (key) =>
    PlatformRuntime.pipe(
      Effect.andThen(client.deleteObject({ Bucket: config.bucketName, Key: key })),
      Effect.asVoid,
      Effect.mapError((cause) => storeError(config, key, "delete", cause)),
    ),
});

/** S3-compatible object store layer for AWS S3, MinIO, Garage, or R2. */
export const S3ObjectStoreLive = (
  config: S3ObjectStoreConfig,
): Layer.Layer<ObjectStore> =>
  Layer.effect(
    ObjectStore,
    Effect.map(S3, (client) => makeStore(config, client)),
  ).pipe(
    Layer.provide(
      S3.layer({
        region: config.region,
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle ?? config.endpoint !== undefined,
        // AWS SDK v3 enables CRC32 checksums by default. Some S3-compatible
        // stores reject those optional headers, so custom endpoints use the
        // compatibility mode while native AWS S3 retains its stronger default.
        ...(config.endpoint === undefined
          ? {}
          : {
              requestChecksumCalculation: "WHEN_REQUIRED" as const,
              responseChecksumValidation: "WHEN_REQUIRED" as const,
            }),
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: Redacted.value(config.secretAccessKey),
        },
      }),
    ),
  );

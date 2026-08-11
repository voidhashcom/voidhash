import { ObjectStore, ObjectStoreError } from "@voidhash/platform/ObjectStore";
import { Config, Effect, Layer, Option, Random, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import { S3ObjectStoreLive, type S3ObjectStoreConfig } from "../src/ObjectStore.ts";
import { NodePlatformRuntimeLive } from "../src/PlatformRuntime.ts";

const readConfig = Effect.gen(function* () {
  const config: S3ObjectStoreConfig = {
    bucketName: yield* Config.string("PLATFORM_NODE_S3_BUCKET").pipe(
      Config.withDefault("voidhash-public"),
    ),
    region: yield* Config.string("PLATFORM_NODE_S3_REGION").pipe(Config.withDefault("us-east-1")),
    endpoint: yield* Config.string("PLATFORM_NODE_S3_ENDPOINT").pipe(
      Config.withDefault("http://127.0.0.1:9000"),
    ),
    accessKeyId: yield* Config.string("PLATFORM_NODE_S3_ACCESS_KEY_ID").pipe(
      Config.withDefault("voidhash"),
    ),
    secretAccessKey: yield* Config.redacted("PLATFORM_NODE_S3_SECRET_ACCESS_KEY").pipe(
      Config.withDefault(Redacted.make("password")),
    ),
    forcePathStyle: true,
  };
  return config;
}).pipe(Effect.orDie);

const storeLayer = (
  adjust: (config: S3ObjectStoreConfig) => S3ObjectStoreConfig = (input) => input,
) =>
  Layer.unwrap(
    readConfig.pipe(
      Effect.map((config) =>
        Layer.merge(S3ObjectStoreLive(adjust(config)), NodePlatformRuntimeLive),
      ),
    ),
  );

const uniqueSuffix = Effect.gen(function* () {
  const high = yield* Random.nextInt;
  const low = yield* Random.nextInt;
  return `${high.toString(36)}${low.toString(36)}`;
});

describe("S3-compatible object store", () => {
  it("writes, reads, heads, overwrites, and deletes objects", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const key = `tests/${yield* uniqueSuffix}.txt`;
        const initial = new TextEncoder().encode("first value");
        const replacement = new TextEncoder().encode("replacement value");

        const result = yield* Effect.gen(function* () {
          const store = yield* ObjectStore;
          const missing = yield* store.get(key);
          yield* store.put({ key, body: initial, contentType: "text/plain" });
          const stored = yield* store.get(key);
          const head = yield* store.head(key);
          yield* store.put({ key, body: replacement, contentType: "text/custom" });
          const overwritten = yield* store.get(key);
          yield* store.delete(key);
          yield* store.delete(key);
          const deleted = yield* store.head(key);
          return { missing, stored, head, overwritten, deleted };
        }).pipe(Effect.provide(storeLayer()));

        expect(Option.isNone(result.missing)).toBe(true);
        expect(Option.getOrThrow(result.stored)).toMatchObject({
          body: initial,
          contentType: "text/plain",
          size: initial.byteLength,
        });
        expect(Option.getOrThrow(result.head)).toMatchObject({
          contentType: "text/plain",
          size: initial.byteLength,
        });
        expect(Option.getOrThrow(result.overwritten)).toMatchObject({
          body: replacement,
          contentType: "text/custom",
          size: replacement.byteLength,
        });
        expect(Option.isNone(result.deleted)).toBe(true);
      }),
    ));

  it("maps bucket failures to the stable object-store error", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* readConfig;
        const missingBucket = `${config.bucketName}-missing-${yield* uniqueSuffix}`;
        const error = yield* Effect.gen(function* () {
          const store = yield* ObjectStore;
          return yield* store.get("missing").pipe(Effect.flip);
        }).pipe(Effect.provide(storeLayer((input) => ({ ...input, bucketName: missingBucket }))));

        expect(error).toBeInstanceOf(ObjectStoreError);
        expect(error.bucketName).toBe(missingBucket);
        expect(error.operation).toBe("get");
      }),
    ));
});

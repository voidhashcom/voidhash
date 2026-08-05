import { ObjectStore, ObjectStoreError } from "@voidhash/platform/ObjectStore";
import { Effect, Layer, Option, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import { S3ObjectStoreLive, type S3ObjectStoreConfig } from "../src/ObjectStore.ts";
import { SelfhostPlatformRuntimeLive } from "../src/PlatformRuntime.ts";

const config: S3ObjectStoreConfig = {
  bucketName: process.env.PLATFORM_SELFHOST_S3_BUCKET ?? "voidhash-public",
  region: process.env.PLATFORM_SELFHOST_S3_REGION ?? "us-east-1",
  endpoint: process.env.PLATFORM_SELFHOST_S3_ENDPOINT ?? "http://127.0.0.1:9000",
  accessKeyId: process.env.PLATFORM_SELFHOST_S3_ACCESS_KEY_ID ?? "voidhash",
  secretAccessKey: Redacted.make(
    process.env.PLATFORM_SELFHOST_S3_SECRET_ACCESS_KEY ?? "password",
  ),
  forcePathStyle: true,
};

const storeLayer = (input: S3ObjectStoreConfig = config) =>
  Layer.merge(S3ObjectStoreLive(input), SelfhostPlatformRuntimeLive);

describe("S3-compatible object store", () => {
  it("writes, reads, heads, overwrites, and deletes objects", async () => {
    const key = `tests/${crypto.randomUUID()}.txt`;
    const initial = new TextEncoder().encode("first value");
    const replacement = new TextEncoder().encode("replacement value");

    const result = await Effect.runPromise(
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(storeLayer())),
    );

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
  });

  it("maps bucket failures to the stable object-store error", async () => {
    const missingBucket = `${config.bucketName}-missing-${crypto.randomUUID()}`;
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ObjectStore;
        return yield* store.get("missing").pipe(Effect.flip);
      }).pipe(
        Effect.provide(
          storeLayer({
            ...config,
            bucketName: missingBucket,
          }),
        ),
      ),
    );

    expect(error).toBeInstanceOf(ObjectStoreError);
    expect(error.bucketName).toBe(missingBucket);
    expect(error.operation).toBe("get");
  });
});

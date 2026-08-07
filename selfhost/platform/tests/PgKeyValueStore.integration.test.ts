import { KeyValueStore, KeyValueStoreError } from "@voidhash/platform/KeyValueStore";
import { Config, Effect, Layer, Option, Random, Redacted, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { PgKeyValueStoreLive } from "../src/KeyValueStore.ts";
import { SelfhostPlatformRuntimeLive } from "../src/PlatformRuntime.ts";
import type { PgPlatformConfig } from "../src/Postgres.ts";

const readConfig = Effect.gen(function* () {
  const config: PgPlatformConfig = {
    host: yield* Config.string("PLATFORM_SELFHOST_PG_HOST").pipe(Config.withDefault("127.0.0.1")),
    port: yield* Config.int("PLATFORM_SELFHOST_PG_PORT").pipe(Config.withDefault(5432)),
    database: yield* Config.string("PLATFORM_SELFHOST_PG_DATABASE").pipe(
      Config.withDefault("voidhash"),
    ),
    username: yield* Config.string("PLATFORM_SELFHOST_PG_USERNAME").pipe(
      Config.withDefault("voidhash"),
    ),
    password: yield* Config.redacted("PLATFORM_SELFHOST_PG_PASSWORD").pipe(
      Config.withDefault(Redacted.make("password")),
    ),
  };
  return config;
}).pipe(Effect.orDie);

const storeLayer = () =>
  Layer.unwrap(
    readConfig.pipe(
      Effect.map((config) =>
        Layer.merge(PgKeyValueStoreLive(config), SelfhostPlatformRuntimeLive),
      ),
    ),
  );

const uniqueSuffix = Effect.gen(function* () {
  const high = yield* Random.nextInt;
  const low = yield* Random.nextInt;
  return `${high.toString(36)}${low.toString(36)}`;
});

describe("Postgres key-value store", () => {
  it("persists typed object and string values across layer restarts", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const namespace = `kv-persistence-${yield* uniqueSuffix}`;
        const profileSchema = Schema.Struct({ name: Schema.String, version: Schema.Number });

        yield* Effect.gen(function* () {
          const store = yield* KeyValueStore;
          yield* store.put(
            namespace,
            "profile",
            { name: "node", version: 1 },
            profileSchema,
          );
          yield* store.put(namespace, "label", "node-string", Schema.String);
        }).pipe(Effect.provide(storeLayer()));

        const restored = yield* Effect.gen(function* () {
          const store = yield* KeyValueStore;
          const values = yield* Effect.all({
            profile: store.get(namespace, "profile", profileSchema),
            label: store.get(namespace, "label", Schema.String),
          });
          yield* store.deleteMany(namespace, ["profile", "label"]);
          return values;
        }).pipe(Effect.provide(storeLayer()));

        expect(Option.getOrThrow(restored.profile)).toEqual({ name: "node", version: 1 });
        expect(Option.getOrThrow(restored.label)).toBe("node-string");
      }),
    ));

  it("supports bulk existence checks and expiry pruning", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const namespace = `kv-expiry-${yield* uniqueSuffix}`;

        const result = yield* Effect.gen(function* () {
          const store = yield* KeyValueStore;
          yield* store.putMany(
            namespace,
            [
              { key: "one", value: 1 },
              { key: "two", value: 2 },
              { key: "three", value: 3 },
            ],
            Schema.Number,
            // Long enough that the round trip to Postgres for `before` cannot
            // outlive the entries. A tighter window makes the first assertion race
            // its own setup and fail under the load of a full suite run.
            { ttlMillis: 1_000 },
          );
          const before = yield* store.existingKeys(namespace, ["one", "two", "three", "missing"]);
          yield* Effect.sleep("1500 millis");
          const after = yield* store.existingKeys(namespace, ["one", "two", "three"]);
          const pruned = yield* store.pruneExpired(10_000);
          return { before, after, pruned };
        }).pipe(Effect.provide(storeLayer()));

        expect(result.before).toEqual(new Set(["one", "two", "three"]));
        expect(result.after.size).toBe(0);
        expect(result.pruned).toBeGreaterThanOrEqual(3);
      }),
    ));

  it("increments counters atomically under concurrency", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const namespace = `kv-counter-${yield* uniqueSuffix}`;
        const key = "requests";

        const result = yield* Effect.gen(function* () {
          const store = yield* KeyValueStore;
          const increments = yield* Effect.all(
            Array.from({ length: 50 }, () => store.increment(namespace, key)),
            { concurrency: "unbounded" },
          );
          const stored = yield* store.get(namespace, key, Schema.Number);
          yield* store.delete(namespace, key);
          return { increments, stored };
        }).pipe(Effect.provide(storeLayer()));

        expect([...result.increments].sort((left, right) => left - right)).toEqual(
          Array.from({ length: 50 }, (_, index) => index + 1),
        );
        expect(Option.getOrThrow(result.stored)).toBe(50);
      }),
    ));

  it("restarts an expired counter at one", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const namespace = `kv-counter-expiry-${yield* uniqueSuffix}`;
        const key = "events";

        const values = yield* Effect.gen(function* () {
          const store = yield* KeyValueStore;
          const first = yield* store.increment(namespace, key, { ttlMillis: 20 });
          yield* Effect.sleep("40 millis");
          const reset = yield* store.increment(namespace, key, { ttlMillis: 20 });
          yield* store.delete(namespace, key);
          return { first, reset };
        }).pipe(Effect.provide(storeLayer()));

        expect(values).toEqual({ first: 1, reset: 1 });
      }),
    ));

  it("maps schema mismatches to the stable store error", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const namespace = `kv-schema-${yield* uniqueSuffix}`;

        const error = yield* Effect.gen(function* () {
          const store = yield* KeyValueStore;
          yield* store.put(namespace, "value", "text", Schema.String);
          const failure = yield* store.get(namespace, "value", Schema.Number).pipe(Effect.flip);
          yield* store.delete(namespace, "value");
          return failure;
        }).pipe(Effect.provide(storeLayer()));

        expect(error).toBeInstanceOf(KeyValueStoreError);
        expect(error.operation).toBe("get");
      }),
    ));
});

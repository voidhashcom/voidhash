import { Db } from "@voidhash/db";
import { Config, Effect } from "effect";
import { test as vitestTest } from "vitest";

/**
 * Postgres connection settings for the local integration database, read from
 * the environment through `Config` (each key falls back to the local default).
 */
const databaseConfig = Effect.gen(function* () {
  return {
    databaseName: yield* Config.string("DATABASE_NAME").pipe(Config.withDefault("voidhash")),
    host: yield* Config.string("DATABASE_HOST").pipe(Config.withDefault("127.0.0.1")),
    password: yield* Config.string("DATABASE_PASSWORD").pipe(Config.withDefault("password")),
    port: yield* Config.port("DATABASE_PORT").pipe(Config.withDefault(5432)),
    username: yield* Config.string("DATABASE_USERNAME").pipe(Config.withDefault("voidhash")),
  };
}).pipe(Effect.orDie);

/** Lean Postgres-only harness for purchase-provider integration tests. */
export const PurchaseIntegrationTestHarness = {
  make: () => ({
    test: <E>(name: string, effect: Effect.Effect<void, E, Db>): void => {
      vitestTest(name, () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const config = yield* databaseConfig;
            yield* effect.pipe(Effect.provide(Db.layer(config)));
          }),
        ),
      );
    },
  }),
};

import { Db } from "@voidhash/db";
import { Effect } from "effect";
import { test as vitestTest } from "vitest";

const databaseConfig = {
  databaseName: process.env.DATABASE_NAME ?? "voidhash",
  host: process.env.DATABASE_HOST ?? "127.0.0.1",
  password: process.env.DATABASE_PASSWORD ?? "password",
  port: Number(process.env.DATABASE_PORT ?? "5432"),
  username: process.env.DATABASE_USERNAME ?? "voidhash",
};

/** Lean Postgres-only harness for purchase-provider integration tests. */
export const PurchaseIntegrationTestHarness = {
  make: () => ({
    test: <E>(name: string, effect: Effect.Effect<void, E, Db>): void => {
      vitestTest(name, () =>
        Effect.runPromise(effect.pipe(Effect.provide(Db.layer(databaseConfig)))),
      );
    },
  }),
};

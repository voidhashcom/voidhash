import { Db } from "@voidhash/db";
import { Config, Effect } from "effect";

import { cleanupFixture, seedFixture } from "./CoreTestSeed.ts";

const envOr = (name: string, fallback: string) =>
  Config.string(name).pipe(Config.withDefault(fallback), Effect.orDie);

export default function setup() {
  return Effect.runPromise(
    Effect.gen(function* () {
      const database = Db.layer({
        databaseName: yield* envOr("DATABASE_NAME", "voidhash"),
        host: yield* envOr("DATABASE_HOST", "127.0.0.1"),
        password: yield* envOr("DATABASE_PASSWORD", "password"),
        port: Number(yield* envOr("DATABASE_PORT", "5432")),
        username: yield* envOr("DATABASE_USERNAME", "voidhash"),
      });
      yield* seedFixture.pipe(Effect.provide(database));

      return () => Effect.runPromise(cleanupFixture.pipe(Effect.provide(database)));
    }),
  );
}

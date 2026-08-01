import { Db } from "@voidhash/db";
import { Effect } from "effect";

import { cleanupFixture, seedFixture } from "./CoreTestSeed.ts";

const databaseConfig = {
  databaseName: process.env.DATABASE_NAME ?? "voidhash",
  host: process.env.DATABASE_HOST ?? "127.0.0.1",
  password: process.env.DATABASE_PASSWORD ?? "password",
  port: Number(process.env.DATABASE_PORT ?? "5432"),
  username: process.env.DATABASE_USERNAME ?? "voidhash",
};

export default async function setup() {
  const database = Db.layer(databaseConfig);
  await Effect.runPromise(seedFixture.pipe(Effect.provide(database)));

  return () => Effect.runPromise(cleanupFixture.pipe(Effect.provide(database)));
}

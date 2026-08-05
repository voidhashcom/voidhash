import { Db } from "@voidhash/db";
import * as Effect from "effect/Effect";

import {
  coreTestConnectionsFromEnv,
  type CoreStackOutput,
} from "./CoreTestConnections.ts";
import { cleanupFixture, seedFixture } from "./CoreTestSeed.ts";

/**
 * Community composition of the core integration environment: the local
 * self-host stack. Connections are derived from the environment (see
 * the repo-root `.env.example` and `scripts/run-local-integration.mjs`), the shared
 * fixture is seeded, and the contract is shared with every test file via
 * vitest's `provide`/`inject`.
 *
 * Downstream compositions run the exact same suite by supplying their own
 * globalSetup: provision infrastructure however they like, then `provide` the
 * same `coreStackOutput` shape. Provisioning is the composition's
 * responsibility; the suite only consumes the contract.
 */
export default async function setup({
  provide,
}: {
  readonly provide: (key: "coreStackOutput", value: CoreStackOutput) => void;
}) {
  const testConnections = coreTestConnectionsFromEnv();
  const database = Db.layer(testConnections.db);

  try {
    await Effect.runPromise(seedFixture.pipe(Effect.provide(database)));
  } catch (cause) {
    throw new Error(
      "Core integration setup could not seed the fixture. Is the self-host stack running? " +
        "Start it with `pnpm stack:up` (see selfhost/README.md) or point DATABASE_* at a migrated database.",
      { cause },
    );
  }

  provide("coreStackOutput", { testConnections });

  return async () => {
    await Effect.runPromise(cleanupFixture.pipe(Effect.provide(database)));
  };
}

// oxlint-disable effect/noAsyncFunction, effect/noGlobals, effect/noTernary -- standalone bootstrap script: it must read process env, print the bound URL for shell orchestration, and exit with signal semantics; wrapping it in an Effect runtime would add nothing.
import { startHarness } from "../src/index";

const handle = await startHarness({ port: process.env.HARNESS_PORT ? Number(process.env.HARNESS_PORT) : 0 });

console.log(`HARNESS_READY url=${handle.url}`);

const shutdown = () => {
  void handle.shutdown().finally(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

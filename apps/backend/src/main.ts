import { NodeRuntime } from "@effect/platform-node";
import {
  NoBackendFeatures,
  NoBackendRpcExtension,
} from "@voidhash/backend/BackendApp";

import { runSelfhostServer } from "./server.ts";

NodeRuntime.runMain(
  // oxlint-disable-next-line effect/noAs -- erases the self-host server Effect's requirement/error shape for `NodeRuntime.runMain` at the single process entrypoint; `satisfies` only checks a type, it cannot perform this erasure.
  runSelfhostServer({
    edition: "Community Edition",
    features: NoBackendFeatures,
    rpcExtension: () => NoBackendRpcExtension,
  }) as never,
);

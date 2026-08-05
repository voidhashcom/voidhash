import { NodeRuntime } from "@effect/platform-node";
import {
  NoBackendFeatures,
  NoBackendRpcExtension,
} from "@voidhash/backend/BackendApp";

import { runSelfhostServer } from "./server.ts";

NodeRuntime.runMain(
  runSelfhostServer({
    edition: "Community Edition",
    features: NoBackendFeatures,
    rpcExtension: () => NoBackendRpcExtension,
  }) as never,
);

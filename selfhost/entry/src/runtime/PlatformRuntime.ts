import { Layer } from "effect";

import { PlatformRuntime } from "@orbian/sdk/PlatformRuntime";

/** Platform runtime marker for the single-process Node composition. */
export const NodePlatformRuntimeLive = Layer.succeed(PlatformRuntime, PlatformRuntime.of({}));

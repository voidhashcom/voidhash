import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { Layer } from "effect";

/**
 * Marks effects as running inside a configured Node platform runtime.
 *
 * The marker carries no capabilities; it exists so application code cannot
 * reach a platform primitive without a composition root having installed one.
 */
export const NodePlatformRuntimeLive: Layer.Layer<PlatformRuntime> = Layer.succeed(
  PlatformRuntime,
  PlatformRuntime.of({}),
);

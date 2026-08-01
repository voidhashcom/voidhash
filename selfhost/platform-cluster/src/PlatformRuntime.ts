import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { Layer } from "effect";

/**
 * Marks effects as running inside a configured cluster runtime.
 *
 * The marker carries no capabilities; it exists so application code cannot
 * reach a platform primitive without a composition root having installed one.
 */
export const ClusterPlatformRuntimeLive: Layer.Layer<PlatformRuntime> = Layer.succeed(
  PlatformRuntime,
  PlatformRuntime.of({}),
);

import * as Context from "effect/Context";

export type PlatformRuntimeShape = Readonly<Record<never, never>>;

/**
 * Marks effects that may only execute inside a configured platform runtime.
 * Runtime adapters provide this service at their handler boundaries.
 */
export class PlatformRuntime extends Context.Service<PlatformRuntime, PlatformRuntimeShape>()(
  "@voidhash/platform/PlatformRuntime",
) {}

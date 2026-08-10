import { RuntimeContext, type BaseRuntimeContext } from "alchemy/RuntimeContext";
import { Effect, Layer } from "effect";

import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";

/** Cloudflare implementation of the provider-neutral runtime marker. */
export const PlatformRuntimeLive: Layer.Layer<PlatformRuntime, never, RuntimeContext> =
  Layer.effect(PlatformRuntime, RuntimeContext.pipe(Effect.as(PlatformRuntime.of({}))));

/**
 * Provides the Cloudflare runtime behind a captured platform operation while
 * retaining the provider-neutral runtime requirement exposed to callers.
 */
export const requirePlatformRuntime = <A, E>(
  effect: Effect.Effect<A, E, RuntimeContext>,
  runtimeContext: BaseRuntimeContext,
): Effect.Effect<A, E, PlatformRuntime> =>
  PlatformRuntime.pipe(
    Effect.andThen(Effect.provideService(effect, RuntimeContext, runtimeContext)),
  );

/** Translates the provider-neutral runtime requirement at a Cloudflare boundary. */
export const providePlatformRuntime = <A, E, R>(
  effect: Effect.Effect<A, E, R | PlatformRuntime>,
): Effect.Effect<A, E, R | RuntimeContext> => Effect.provide(effect, PlatformRuntimeLive);

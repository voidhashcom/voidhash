import { Effect, Layer } from "effect";

/** Executes an Effect against services selected by connection-specific input. */
export interface EffectRunner<ConnectionData, R> {
  <A, E>(
    connectionData: ConnectionData,
    effect: Effect.Effect<A, E, R>,
    signal?: AbortSignal,
  ): Promise<A>;
}

/** Executes an Effect after its connection-specific input has been bound. */
export interface BoundEffectRunner<R> {
  <A, E>(effect: Effect.Effect<A, E, R>, signal?: AbortSignal): Promise<A>;
}

/** Binds connection data to an Effect runner without acquiring any services yet. */
export const bindEffectRunner =
  <ConnectionData, R>(
    runner: EffectRunner<ConnectionData, R>,
    connectionData: ConnectionData,
  ): BoundEffectRunner<R> =>
  (effect, signal) =>
    runner(connectionData, effect, signal);

/**
 * Builds a fresh scoped Layer for every execution and releases it only after
 * the supplied Effect completes.
 */
export const makeLayerEffectRunner =
  <ConnectionData, R>(
    layerFor: (connectionData: ConnectionData) => Layer.Layer<R>,
  ): EffectRunner<ConnectionData, R> =>
  (connectionData, effect, signal) =>
    Effect.runPromise(
      effect.pipe(Effect.provide(layerFor(connectionData))),
      signal === undefined ? undefined : { signal },
    );

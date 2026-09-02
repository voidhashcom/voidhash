import * as Effect from "effect/Effect";
import { runPromise } from "./RuntimeBoundary.ts";
import * as Layer from "effect/Layer";

/** Executes an Effect against services selected by connection-specific input. */
export interface EffectRunner<ConnectionData, R> {
  <A, E>(
    connectionData: ConnectionData,
    effect: Effect.Effect<A, E, R>,
    ...signals: [] | [signal: AbortSignal]
  ): Promise<A>;
}

/** Executes an Effect after its connection-specific input has been bound. */
export interface BoundEffectRunner<R> {
  <A, E>(effect: Effect.Effect<A, E, R>, ...signals: [] | [signal: AbortSignal]): Promise<A>;
}

/** Binds connection data to an Effect runner without acquiring any services yet. */
export const bindEffectRunner =
  <ConnectionData, R>(
    runner: EffectRunner<ConnectionData, R>,
    connectionData: ConnectionData,
  ): BoundEffectRunner<R> =>
  (effect, ...signals) =>
    runner(connectionData, effect, ...signals);

const runOptions = (signal: AbortSignal | void): Readonly<Partial<{ signal: AbortSignal }>> => {
  if (signal === undefined) return {};
  return { signal };
};

/**
 * Builds a fresh scoped Layer for every execution and releases it only after
 * the supplied Effect completes.
 */
export const makeLayerEffectRunner =
  <ConnectionData, R>(
    layerFor: (connectionData: ConnectionData) => Layer.Layer<R>,
  ): EffectRunner<ConnectionData, R> =>
  (connectionData, effect, ...signals) =>
    runPromise(effect.pipe(Effect.provide(layerFor(connectionData))), runOptions(signals[0]));

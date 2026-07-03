/**
 * Minimal ambient typings for `react-reconciler` (the package ships untyped
 * and DefinitelyTyped lags behind the React 19 line). Only the surface used by
 * the tree renderer is declared.
 */
declare module "react-reconciler" {
  import type { ReactNode } from "react";

  /** Opaque fiber root handle. */
  export type OpaqueRoot = unknown;

  export interface ReconcilerInstance<Container> {
    createContainer(
      containerInfo: Container,
      tag: number,
      hydrationCallbacks: null,
      isStrictMode: boolean,
      concurrentUpdatesByDefaultOverride: boolean | null,
      identifierPrefix: string,
      onUncaughtError: (error: unknown, errorInfo?: unknown) => void,
      onCaughtError: (error: unknown, errorInfo?: unknown) => void,
      onRecoverableError: (error: unknown, errorInfo?: unknown) => void,
      transitionCallbacks: null,
    ): OpaqueRoot;
    updateContainer(
      element: ReactNode,
      container: OpaqueRoot,
      parentComponent?: unknown,
      callback?: (() => void) | null,
    ): number;
    flushPassiveEffects(): boolean;
    /**
     * Runs `fn` at discrete (highest, "2") update priority with transitions
     * disabled, then synchronously flushes all pending sync work before
     * returning. Any `setState` inside `fn` is committed before this returns —
     * the mechanism the long-lived panel session uses to make an event
     * handler's state update observable before `dispatchEvent` returns.
     */
    flushSyncFromReconciler<R>(fn: () => R): R;
    /** Flushes any pending synchronous work across all roots. */
    flushSyncWork(): boolean;
  }

  /**
   * Structural host config: the renderer passes a superset of what any given
   * reconciler minor consumes, so unknown members are tolerated.
   */
  export type HostConfig = Record<string, unknown>;

  export default function createReconciler<Container>(
    config: HostConfig,
  ): ReconcilerInstance<Container>;
}

declare module "react-reconciler/constants.js" {
  export const LegacyRoot: number;
  export const ConcurrentRoot: number;
  export const NoEventPriority: number;
  export const DiscreteEventPriority: number;
  export const ContinuousEventPriority: number;
  export const DefaultEventPriority: number;
  export const IdleEventPriority: number;
}

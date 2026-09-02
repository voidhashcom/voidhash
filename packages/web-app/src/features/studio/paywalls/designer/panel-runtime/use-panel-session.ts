"use client";

/**
 * Owns exactly one {@link PanelTransport} for a panel source, for the lifetime of
 * the calling component. The transport is created once (per source identity) and
 * fed fresh inputs via {@link PanelTransport.update} whenever `inputs` change;
 * it is disposed on unmount or when the source identity changes.
 *
 * The source discriminant selects the engine: `builtin` runs the definition
 * in-process ({@link createInProcessTransport}); `component-panel` is the typed
 * seam for the Phase 3 sandbox transport (constructing one throws today).
 */
import type { PanelSessionInputs } from "@voidhash/paywalls/panel";
import { useEffect, useRef } from "react";

import {
  createInProcessTransport,
  type PanelRender,
  type PanelWrap,
  type PanelIntentSink,
} from "./in-process-transport";
import type { PanelTransport } from "./transport";

/** A built-in panel source: a trusted definition run in-process. */
export interface BuiltinPanelSource {
  readonly kind: "builtin";
  /** The panel definition `(ctx) => ReactNode`. */
  readonly render: PanelRender;
  /** Re-wraps providers inside the reconciler root (store context, host services). */
  readonly wrap?: PanelWrap;
  /** Where the definition's writes go (built-ins reduce synchronously; optional). */
  readonly intentSink?: PanelIntentSink;
  /** Reports a definition render/effect error. */
  readonly onError?: (error: unknown) => void;
}

/**
 * A code-component panel source (Phase 3): a sandboxed iframe running the
 * reconciler. Typed here so call sites compile against the final shape; building
 * the transport throws until the sandbox engine lands.
 */
export interface ComponentPanelSource {
  readonly kind: "component-panel";
  /** The compiled component-panel bundle identity (sandbox entry). */
  readonly bundleId: string;
}

/** Every panel source discriminant the host can drive. */
export type PanelSource = BuiltinPanelSource | ComponentPanelSource;

/**
 * Creates the transport for a source. The `component-panel` engine is a typed
 * seam — constructing one throws until Phase 3 provides the sandbox transport.
 */
const createTransportForSource = (
  source: PanelSource,
  initialInputs: PanelSessionInputs,
): PanelTransport => {
  if (source.kind === "builtin") {
    return createInProcessTransport({
      render: source.render,
      initialInputs,
      wrap: source.wrap,
      intentSink: source.intentSink,
      onError: source.onError,
    });
  }
  // component-panel — Phase 3 sandbox transport.
  // oxlint-disable-next-line effect/noThrowStatement -- unreachable-branch guard in a synchronous React hook helper; the sandbox transport lands in Phase 3, and until then this must fail loudly at the call site rather than return an invalid session.
  throw new Error("component-panel transport is not implemented yet (Phase 3 sandbox engine)");
};

interface SessionCell {
  readonly source: PanelSource;
  readonly deps: ReadonlyArray<unknown>;
  readonly transport: PanelTransport;
}

const depsEqual = (a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Owns a {@link PanelTransport} for `source`. The transport is (re)created when
 * `source` identity or any `deps` entry changes, and pushed fresh `inputs` on
 * every change; it is disposed on unmount.
 *
 * The transport is created SYNCHRONOUSLY during render (so the first paint has a
 * live session, no flash of loading) and the same instance is adopted by the
 * disposal effect — there is never a double-create.
 *
 * @param source - the panel source (see {@link PanelSource}); pass a STABLE
 *   reference across renders — a new object each render remounts the session,
 *   which the built-in host deliberately avoids by keying on sectionId.
 * @param inputs - the current host input snapshot, pushed via `update()`.
 * @param deps - extra identity keys that force a transport re-create.
 */
export function usePanelSession(
  source: PanelSource,
  inputs: PanelSessionInputs,
  deps: ReadonlyArray<unknown> = [],
): PanelTransport {
  const cellRef = useRef<SessionCell | null>(null);

  // Create-or-recreate synchronously in render when the identity changed.
  const current = cellRef.current;
  if (current === null || current.source !== source || !depsEqual(current.deps, deps)) {
    current?.transport.dispose();
    cellRef.current = {
      source,
      deps,
      transport: createTransportForSource(source, inputs),
    };
  }
  const transport = cellRef.current!.transport;

  // Push fresh inputs whenever they change.
  const initialInputsRef = useRef(inputs);
  useEffect(() => {
    // Skip the very first run for this transport instance: the transport was
    // constructed with these exact inputs, so an immediate re-push is redundant.
    if (initialInputsRef.current === inputs) {
      initialInputsRef.current = null as unknown as PanelSessionInputs;
      return;
    }
    transport.update(inputs);
  }, [transport, inputs]);

  // Dispose on unmount (the render path disposes on identity change).
  useEffect(() => {
    return () => {
      cellRef.current?.transport.dispose();
      cellRef.current = null;
    };
  }, []);

  return transport;
}

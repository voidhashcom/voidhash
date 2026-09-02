/**
 * A long-lived editor-panel session: mounts a panel definition into the
 * persistent {@link createPanelReconciler} container, keeps it re-rendering as
 * the host pushes fresh {@link PanelSessionInputs}, serializes each commit into
 * a {@link PanelTree}, and routes author `ctx.props.*` writes to
 * {@link PanelIntent}s.
 *
 * Built-in designer panels run this in-process (trusted, synchronous) and code
 * panels run it inside a sandboxed iframe; both drive it through the same
 * {@link PanelSession} handle. Event dispatch runs at discrete priority so an
 * in-handler `setState` is committed and its tree emitted before
 * `dispatchEvent` returns — what makes 60fps in-process drags possible.
 */
import { Component, type ReactNode } from "react";

import {
  PANEL_CAPS,
  PANEL_TREE_VERSION,
  type PanelJsonValue,
  type PanelRootNode,
  type PanelTree,
} from "../schema/panel-tree";
import type {
  PanelContext,
  PanelData,
  PanelProps,
  PanelPropHandle,
  PanelReadonlyPropHandle,
  PanelRefPropHandle,
  PanelSelection,
  PanelSetOptions,
} from "./context";
import type { PanelIntent } from "./intent";
import { Panel } from "./primitives";
import { createPanelReconciler } from "./reconciler";
import { PanelRuntimeProvider } from "./runtime";
import { serializeRoot } from "./serialize";

const isDev = process.env.NODE_ENV !== "production";

const warn = (message: string): void => {
  if (isDev) {
    // dev-only diagnostic for panel authors.
    console.warn(`[@voidhash/paywalls/panel] ${message}`);
  }
};

// ── Session inputs (the host-computed snapshot) ──────────────────────────────

/** The per-prop snapshot the host computes for one declared prop. */
export interface PanelPropInput {
  /** The prop's current value (resolved to the bound variable's value). */
  readonly value?: PanelJsonValue;
  /** True across a multi-selection with differing values for this prop. */
  readonly mixed?: boolean;
  /** True when the prop is driven by a variable (host owns bind/unbind). */
  readonly bound?: boolean;
  /** The declared prop kind (`"string"`, `"ref"`, `"component"`, …). */
  readonly kind: string;
  /** For a `ref` prop: the referenced entity id. */
  readonly productId?: string;
}

/**
 * The serializable snapshot the host recomputes and hands to the session on
 * every update. The session builds the {@link PanelContext} from it (plus the
 * intent sink for writes).
 */
export interface PanelSessionInputs {
  /** One entry per declared prop, keyed by prop name. */
  readonly props: Readonly<Record<string, PanelPropInput>>;
  /** The current selection the panel edits. */
  readonly selection: PanelSelection;
  /** Injected host data (products, variables). */
  readonly data: PanelData;
}

// ── Session config ───────────────────────────────────────────────────────────

/** The callbacks a session reports through. */
export interface PanelSessionCallbacks {
  /** Called with the serialized tree and a monotonically increasing revision. */
  onTree(tree: PanelTree, revision: number): void;
  /** Called when the definition render throws (before the fallback tree emits). */
  onError(error: unknown): void;
}

/** Configuration for {@link createPanelSession}. */
export interface CreatePanelSessionOptions<P extends PanelProps = PanelProps> {
  /** The panel definition: `(ctx) => ReactNode`. */
  readonly render: (ctx: PanelContext<P>) => ReactNode;
  /** The initial host snapshot (see {@link update} for later ones). */
  readonly initialInputs: PanelSessionInputs;
  readonly callbacks: PanelSessionCallbacks;
  /** Where `ctx.props.*` writes go. Built-in hosts reduce these synchronously. */
  readonly intentSink?: (intents: ReadonlyArray<PanelIntent>) => void;
  /**
   * Lets a trusted built-in host re-wrap providers (a zustand store context,
   * theme, …) around the definition. Applied inside the panel runtime provider.
   */
  readonly wrap?: (children: ReactNode) => ReactNode;
}

/** The handle the host drives a session through. */
export interface PanelSession {
  /** Pushes a fresh host snapshot; triggers a re-render + tree emission. */
  update(inputs: PanelSessionInputs): void;
  /**
   * Dispatches a fired event to the live node's current handler. Returns true
   * when a handler ran, false for a stale/unknown `(nodeId, name)`.
   */
  dispatchEvent(nodeId: number, name: string, args: ReadonlyArray<unknown>): boolean;
  /** The most recently emitted tree (or the empty-panel fallback). */
  getTree(): PanelTree;
  /** Unmounts the definition and releases the container. */
  dispose(): void;
}

// ── Error boundary ───────────────────────────────────────────────────────────

interface BoundaryProps {
  onError: (error: unknown) => void;
  children: ReactNode;
}
interface BoundaryState {
  failed: boolean;
}

/**
 * Catches a throwing definition render. On failure it reports the error through
 * `onError` (so the host can surface it) and renders a generic fallback panel —
 * a root `<Panel>` with a single neutral error `callout`. The author's error
 * text never enters the tree (it goes through `onError` only); the serializer
 * turns the fallback panel into the wire tree like any other render.
 */
class PanelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <Panel>
          <Panel.Callout message="This panel failed to render." tone="error" />
        </Panel>
      );
    }
    return this.props.children;
  }
}

// ── Definition host ──────────────────────────────────────────────────────────

interface DefinitionHostProps<P extends PanelProps> {
  render: (ctx: PanelContext<P>) => ReactNode;
  ctx: PanelContext<P>;
}

/**
 * Invokes the panel definition INSIDE React's render phase, so the definition
 * may use hooks (`useState`, `useEffect`, timers). Calling `render(ctx)` eagerly
 * outside a component would break the rules of hooks.
 */
const PanelDefinitionHost = <P extends PanelProps>({
  render,
  ctx,
}: DefinitionHostProps<P>): ReactNode => render(ctx);

// ── Fallback trees ───────────────────────────────────────────────────────────

// Fallback trees replace the WHOLE tree (they never mix with reconciler-minted
// ids), so small fixed non-negative ids stay unique and satisfy the wire
// contract (ids must be non-negative integers, unique within a tree).

/** A root `panel` containing a single error `callout` — leaks no author text. */
const errorFallbackRoot = (): PanelRootNode => ({
  type: "panel",
  id: 0,
  props: {},
  events: [],
  children: [
    {
      type: "callout",
      id: 1,
      props: { message: "This panel failed to render.", tone: "error" },
      events: [],
    },
  ],
});

/** An empty root `panel`, used before the first commit and for empty renders. */
const emptyRoot = (): PanelRootNode => ({
  type: "panel",
  id: 0,
  props: {},
  events: [],
  children: [],
});

// ── Context construction ─────────────────────────────────────────────────────

const byteSize = (value: PanelJsonValue): number => {
  const json = JSON.stringify(value);
  return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(json).length : json.length;
};

/**
 * Builds the {@link PanelContext} from a host snapshot. Prop handles capture the
 * `emit` sink so `set`/`cancel`/`reset` produce intents. A `bound` prop's `set`
 * is dropped (host owns binding); an oversized `set-prop` value is dropped.
 */
const buildContext = <P extends PanelProps>(
  inputs: PanelSessionInputs,
  emit: (intents: ReadonlyArray<PanelIntent>) => void,
): PanelContext<P> => {
  const props: Record<string, unknown> = {};

  for (const [name, input] of Object.entries(inputs.props)) {
    const kind = input.kind;
    if (kind === "ref") {
      const product = inputs.data.products.find((p) => p.id === input.productId);
      const handle: PanelRefPropHandle = {
        value: product,
        productId: input.productId,
        mixed: input.mixed ?? false,
        kind: "ref",
        set: (productId: string) => {
          emit([{ type: "set-ref", name, productId }]);
        },
      };
      props[name] = handle;
      continue;
    }
    if (kind === "component") {
      const handle: PanelReadonlyPropHandle = {
        value: input.value,
        mixed: input.mixed ?? false,
        kind: "component",
      };
      props[name] = handle;
      continue;
    }

    const bound = input.bound ?? false;
    const handle: PanelPropHandle = {
      value: input.value,
      mixed: input.mixed ?? false,
      bound,
      // Safe: PropKind is a closed string union; the host supplies a legal kind.
      kind: kind as PanelPropHandle["kind"],
      set: (value: PanelJsonValue, options?: PanelSetOptions) => {
        if (bound) {
          warn(`prop "${name}" is bound to a variable; set() is ignored`);
          return;
        }
        if (byteSize(value) > PANEL_CAPS.intentBytes) {
          warn(
            `prop "${name}" set() value exceeds ${PANEL_CAPS.intentBytes} bytes and was dropped`,
          );
          return;
        }
        emit([{ type: "set-prop", name, value, gesture: options?.gesture ?? "commit" }]);
      },
      cancel: () => {
        emit([{ type: "gesture-discard", name }]);
      },
      reset: () => {
        emit([{ type: "reset-prop", name }]);
      },
    };
    props[name] = handle;
  }

  return {
    props: props as P,
    selection: inputs.selection,
    data: inputs.data,
  };
};

// ── Session ──────────────────────────────────────────────────────────────────

/**
 * Creates a long-lived panel session. React state, effects, and timers all work
 * for the session's lifetime; call {@link PanelSession.dispose} to tear it down.
 */
export const createPanelSession = <P extends PanelProps = PanelProps>(
  options: CreatePanelSessionOptions<P>,
): PanelSession => {
  const { reconciler, container, instances, attach, ConcurrentRoot } = createPanelReconciler();

  let inputs = options.initialInputs;
  let revision = 0;
  let lastTree: PanelTree = { version: PANEL_TREE_VERSION, root: emptyRoot() };
  let disposed = false;

  // Microtask coalescing: a commit bumps `commitGeneration`; the scheduled
  // emit runs only if it is still the latest generation when it fires. Setting
  // `pendingEmit` lets `dispatchEvent` flush the emission synchronously instead
  // (draining what the microtask would have done, so the tree is observable
  // before dispatch returns).
  let commitGeneration = 0;
  let pendingEmit = false;

  const emitIntents = (intents: ReadonlyArray<PanelIntent>): void => {
    if (intents.length === 0) return;
    options.intentSink?.(intents);
  };

  const serialize = (): PanelTree => {
    const root = serializeRoot(container.children, (reason) => {
      warn(reason);
      return emptyRoot();
    });
    return { version: PANEL_TREE_VERSION, root };
  };

  // Delivers the pending emission to `onTree`. `lastTree` is already fresh (the
  // commit hook re-serializes synchronously), so `getTree()` never lags — this
  // only fires the (coalesced) notification.
  const flushEmit = (): void => {
    if (!pendingEmit || disposed) return;
    pendingEmit = false;
    revision += 1;
    options.callbacks.onTree(lastTree, revision);
  };

  // Runs synchronously on every commit: refresh `lastTree` immediately, then
  // coalesce the `onTree` notification into ONE microtask (latest wins). A
  // synchronous `flushEmit()` (after an event dispatch) drains it early.
  const scheduleEmit = (): void => {
    if (disposed) return;
    lastTree = serialize();
    pendingEmit = true;
    const generation = ++commitGeneration;
    queueMicrotask(() => {
      if (generation !== commitGeneration) return;
      flushEmit();
    });
  };

  attach({ onCommit: scheduleEmit });

  const root = reconciler.createContainer(
    container,
    ConcurrentRoot,
    null,
    false,
    null,
    "vhp",
    (error: unknown) => {
      // An uncaught error escaping the boundary (e.g. thrown in a passive
      // effect, which boundaries don't catch): report it and emit the neutral
      // error fallback so the host still gets a tree.
      if (disposed) return;
      options.callbacks.onError(error);
      lastTree = { version: PANEL_TREE_VERSION, root: errorFallbackRoot() };
      pendingEmit = true;
      flushEmit();
    },
    () => {
      // onCaughtError: the boundary already reports through componentDidCatch.
    },
    () => {
      // onRecoverableError: hydration-only; unused here.
    },
    null,
  );

  const renderTree = (): void => {
    const ctx = buildContext<P>(inputs, emitIntents);
    // The definition is rendered as a component (not called eagerly) so it may
    // use hooks. `wrap` lets a trusted host inject providers around it.
    const definition = <PanelDefinitionHost render={options.render} ctx={ctx} />;
    const wrapped = options.wrap ? options.wrap(definition) : definition;
    const element = (
      <PanelErrorBoundary onError={(error) => options.callbacks.onError(error)}>
        <PanelRuntimeProvider value={ctx}>{wrapped}</PanelRuntimeProvider>
      </PanelErrorBoundary>
    );
    // Flush the render synchronously (initial mount and updates alike) so the
    // committed tree is serialized on the same tick a host `update()` returns —
    // a ConcurrentRoot would otherwise defer the mount to a later task.
    reconciler.flushSyncFromReconciler(() => {
      reconciler.updateContainer(element, root, null, null);
    });
  };

  renderTree();
  // Emit the first tree synchronously so `getTree()` is valid immediately and
  // the host renders without waiting a microtask.
  flushEmit();

  const update = (next: PanelSessionInputs): void => {
    if (disposed) return;
    inputs = next;
    renderTree();
  };

  const dispatchEvent = (nodeId: number, name: string, args: ReadonlyArray<unknown>): boolean => {
    if (disposed) return false;
    const instance = instances.get(nodeId);
    if (instance === undefined) return false;
    const handler = instance.props[name];
    if (typeof handler !== "function") return false;

    // Run the handler at discrete priority: `flushSyncFromReconciler` sets the
    // update priority to Discrete, runs the handler (any `setState` schedules a
    // sync update), then synchronously flushes all pending sync work before
    // returning — so the commit (and its `scheduleEmit`) has already run.
    reconciler.flushSyncFromReconciler(() => {
      (handler as (...a: ReadonlyArray<unknown>) => void)(...args);
    });
    // Drain a still-pending emission synchronously so the resulting tree is
    // observable via `onTree`/`getTree` before this returns.
    flushEmit();
    return true;
  };

  const getTree = (): PanelTree => lastTree;

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    reconciler.updateContainer(null, root, null, null);
    instances.clear();
  };

  return { update, dispatchEvent, getTree, dispose };
};

/**
 * Renders a React element to a §3 preview node tree using a custom
 * `react-reconciler` host. Node-only: the CLI runs this at build time to emit
 * `previews/<state>.json` artifacts. Components may use hooks (including the
 * paywall runtime hooks — the element is wrapped in a `PaywallRuntimeProvider`
 * fed from the supplied fixtures).
 */
import { Component, createElement, type ReactNode } from "react";
import createReconciler from "react-reconciler";
// The explicit ".js" matters: react-reconciler has no `exports` map, so Node
// ESM resolution of the bare "react-reconciler/constants" specifier fails.
import { ConcurrentRoot, DefaultEventPriority } from "react-reconciler/constants.js";

import { captureInlineActionName } from "../internal/action-brand";
import { staticMotionPlatformAdapter } from "../motion/platform";
import { MOTION_STYLE_KEYS, type ResolvedMotionStyle } from "../motion/types";
import { isMotionValue } from "../motion/value";
import { RendererProvider } from "../primitives/host-context";
import type { PaywallBridge } from "../runtime/bridge";
import { normalizeRuntimeConfig, type PaywallRuntimeConfig } from "../runtime/config";
import { PaywallRuntimeProvider } from "../runtime/runtime";
import {
  PAYWALL_TREE_VERSION,
  type PaywallNode,
  type PaywallNodeResizeMode,
  type PaywallNodeTree,
} from "../schema/node-tree";
import {
  PAYWALL_STYLE_KEY_LIST,
  type PaywallStyle,
  type StyleProp,
} from "../schema/style";
import { flattenStyle } from "../style/resolve";
import { TREE_ELEMENT_TYPES, treeHostComponents } from "./tree-host";

// ── Instance model ───────────────────────────────────────────────────────────

interface TreeElementInstance {
  readonly tag: "element";
  readonly type: string;
  props: Record<string, unknown>;
  children: TreeChild[];
}

interface TreeTextInstance {
  readonly tag: "text";
  text: string;
}

type TreeChild = TreeElementInstance | TreeTextInstance;

interface TreeContainer {
  children: TreeChild[];
}

// ── Host config ──────────────────────────────────────────────────────────────

const removeFrom = (list: TreeChild[], child: TreeChild): void => {
  const index = list.indexOf(child);
  if (index >= 0) {
    list.splice(index, 1);
  }
};

const insertInto = (list: TreeChild[], child: TreeChild, before: TreeChild): void => {
  removeFrom(list, child);
  const index = list.indexOf(before);
  list.splice(index < 0 ? list.length : index, 0, child);
};

const noop = (): void => {
  // intentionally empty
};

// React 19 asserts the host context is non-null ("Expected host context to
// exist"), so a shared sentinel object stands in for the unused context.
const HOST_CONTEXT: Record<string, never> = {};

let currentUpdatePriority = 0;

const reconciler = createReconciler<TreeContainer>({
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,
  warnsIfNotActing: false,
  noTimeout: -1,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,

  createInstance: (type: string, props: Record<string, unknown>): TreeElementInstance => ({
    tag: "element",
    type,
    props,
    children: [],
  }),
  createTextInstance: (text: string): TreeTextInstance => ({
    tag: "text",
    text,
  }),
  shouldSetTextContent: () => false,
  finalizeInitialChildren: () => false,
  getRootHostContext: () => HOST_CONTEXT,
  getChildHostContext: (parentContext: unknown) => parentContext,
  getPublicInstance: (instance: TreeChild) => instance,

  appendInitialChild: (parent: TreeElementInstance, child: TreeChild) => {
    parent.children.push(child);
  },
  appendChild: (parent: TreeElementInstance, child: TreeChild) => {
    parent.children.push(child);
  },
  appendChildToContainer: (container: TreeContainer, child: TreeChild) => {
    container.children.push(child);
  },
  insertBefore: (parent: TreeElementInstance, child: TreeChild, before: TreeChild) => {
    insertInto(parent.children, child, before);
  },
  insertInContainerBefore: (container: TreeContainer, child: TreeChild, before: TreeChild) => {
    insertInto(container.children, child, before);
  },
  removeChild: (parent: TreeElementInstance, child: TreeChild) => {
    removeFrom(parent.children, child);
  },
  removeChildFromContainer: (container: TreeContainer, child: TreeChild) => {
    removeFrom(container.children, child);
  },
  clearContainer: (container: TreeContainer) => {
    container.children = [];
  },
  commitUpdate: (
    instance: TreeElementInstance,
    _type: string,
    _prevProps: Record<string, unknown>,
    nextProps: Record<string, unknown>,
  ) => {
    instance.props = nextProps;
  },
  commitTextUpdate: (instance: TreeTextInstance, _oldText: string, newText: string) => {
    instance.text = newText;
  },
  resetTextContent: noop,

  prepareForCommit: () => null,
  resetAfterCommit: noop,
  preparePortalMount: noop,
  hideInstance: noop,
  unhideInstance: noop,
  hideTextInstance: noop,
  unhideTextInstance: noop,
  detachDeletedInstance: noop,
  commitMount: noop,
  getInstanceFromNode: () => null,
  getInstanceFromScope: () => null,
  prepareScopeUpdate: noop,
  beforeActiveInstanceBlur: noop,
  afterActiveInstanceBlur: noop,

  // Priority plumbing (React 19 host-config surface).
  setCurrentUpdatePriority: (priority: number) => {
    currentUpdatePriority = priority;
  },
  getCurrentUpdatePriority: () => currentUpdatePriority,
  resolveUpdatePriority: () =>
    currentUpdatePriority !== 0 ? currentUpdatePriority : DefaultEventPriority,
  getCurrentEventPriority: () => DefaultEventPriority,
  shouldAttemptEagerTransition: () => false,
  requestPostPaintCallback: noop,
  trackSchedulerEvent: noop,
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,

  // Suspense-y commit hooks (unused, but required by newer reconcilers).
  maySuspendCommit: () => false,
  preloadInstance: () => true,
  startSuspendingCommit: noop,
  suspendInstance: noop,
  waitForCommitToBeReady: () => null,
  NotPendingTransition: null,
  resetFormInstance: noop,
});

// ── Serialization ────────────────────────────────────────────────────────────

const ALLOWED_STYLE_KEYS = new Set<string>(PAYWALL_STYLE_KEY_LIST);

const sanitizeStyle = (style: unknown): PaywallStyle => {
  const flat = flattenStyle(style as StyleProp);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (
      value !== undefined &&
      value !== null &&
      !isMotionValue(value) &&
      ALLOWED_STYLE_KEYS.has(key)
    ) {
      out[key] = value;
    }
  }
  return out as PaywallStyle;
};

const sanitizeMotion = (motion: unknown): ResolvedMotionStyle | undefined => {
  if (typeof motion !== "object" || motion === null) return undefined;
  const candidate = motion as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of MOTION_STYLE_KEYS) {
    const value = candidate[key];
    if (
      (typeof value === "number" && Number.isFinite(value)) ||
      (key === "backgroundColor" && typeof value === "string") ||
      (key === "transformOrigin" &&
        typeof value === "object" &&
        value !== null &&
        typeof (value as Record<string, unknown>).x === "number" &&
        typeof (value as Record<string, unknown>).y === "number")
    ) {
      out[key] = value;
    }
  }
  return Object.keys(out).length === 0 ? undefined : (out as ResolvedMotionStyle);
};

const collectText = (children: ReadonlyArray<TreeChild>): string => {
  let text = "";
  for (const child of children) {
    if (child.tag === "text") {
      text += child.text;
    } else if (child.type === TREE_ELEMENT_TYPES.text) {
      text += collectText(child.children);
    }
  }
  return text;
};

const RESIZE_MODES: ReadonlyArray<PaywallNodeResizeMode> = [
  "cover",
  "contain",
  "stretch",
  "center",
];

/**
 * Resolves the declared action a pressable fires, for serialization. A direct
 * `onPress={actions.onSelect}` binding already carries its name in `action`.
 * An inline handler (`onPress={() => actions.onSelect(…)}`) is an unbranded
 * arrow, so it is probed once (its branded action callbacks report their name).
 *
 * This runs at serialize time — AFTER the reconciler has committed and passive
 * effects have flushed — so a probe that triggers an author `setState` merely
 * schedules a concurrent update that never commits before the tree is read
 * synchronously and the container is unmounted. Probing during render (where
 * such an update would re-commit and mutate the tree) is unsafe and avoided.
 */
const resolvePressableAction = (props: Record<string, unknown>): string | undefined => {
  if (typeof props.action === "string") {
    return props.action;
  }
  const onPress = props.onPress;
  return typeof onPress === "function" ? captureInlineActionName(onPress as () => void) : undefined;
};

const serializeChildren = (children: ReadonlyArray<TreeChild>): PaywallNode[] =>
  children.map(serializeChild);

const serializeChild = (child: TreeChild): PaywallNode => {
  if (child.tag === "text") {
    // Bare text outside a <Text> wrapper still becomes a legal §3 text node.
    return { type: "text", style: {}, text: child.text };
  }
  const style = sanitizeStyle(child.props.style);
  const motion = sanitizeMotion(child.props.motion);
  switch (child.type) {
    case TREE_ELEMENT_TYPES.view:
      return {
        type: "view",
        style,
        ...(motion ? { motion } : {}),
        children: serializeChildren(child.children),
      };
    case TREE_ELEMENT_TYPES.pressable: {
      const action = resolvePressableAction(child.props);
      return {
        type: "pressable",
        style,
        ...(motion ? { motion } : {}),
        children: serializeChildren(child.children),
        ...(action !== undefined ? { action } : {}),
      };
    }
    case TREE_ELEMENT_TYPES.scroll:
      return {
        type: "scroll",
        style,
        ...(motion ? { motion } : {}),
        children: serializeChildren(child.children),
      };
    case TREE_ELEMENT_TYPES.text:
      return { type: "text", style, ...(motion ? { motion } : {}), text: collectText(child.children) };
    case TREE_ELEMENT_TYPES.image: {
      const resizeMode = child.props.resizeMode as PaywallNodeResizeMode | undefined;
      return {
        type: "image",
        style,
        ...(motion ? { motion } : {}),
        src: typeof child.props.src === "string" ? child.props.src : "",
        ...(resizeMode && RESIZE_MODES.includes(resizeMode) ? { resizeMode } : {}),
      };
    }
    case TREE_ELEMENT_TYPES.slot:
      return { type: "slot" };
    case TREE_ELEMENT_TYPES.placeholder: {
      const reason: unknown = child.props.reason;
      return {
        type: "placeholder",
        reason: typeof reason === "string" ? reason : "unknown",
      };
    }
    default:
      // A non-paywall element reached the renderer (e.g. a raw DOM tag).
      return {
        type: "placeholder",
        reason: `unsupported element type "${child.type}"`,
      };
  }
};

const serializeRoot = (container: TreeContainer): PaywallNode => {
  const nodes = serializeChildren(container.children);
  if (nodes.length === 0) {
    return { type: "placeholder", reason: "render returned null" };
  }
  if (nodes.length === 1) {
    return nodes[0] as PaywallNode;
  }
  // Multiple top-level nodes (a fragment root) get an implicit view wrapper so
  // the tree keeps a single root.
  return { type: "view", style: {}, children: nodes };
};

// ── Error capture ────────────────────────────────────────────────────────────

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

interface TreeErrorBoundaryProps {
  children: ReactNode;
}

interface TreeErrorBoundaryState {
  error: unknown;
  failed: boolean;
}

/** Converts a throwing render into a §3 placeholder node. */
class TreeErrorBoundary extends Component<TreeErrorBoundaryProps, TreeErrorBoundaryState> {
  state: TreeErrorBoundaryState = { error: null, failed: false };

  static getDerivedStateFromError(error: unknown): TreeErrorBoundaryState {
    return { error, failed: true };
  }

  render(): ReactNode {
    if (this.state.failed) {
      return createElement(TREE_ELEMENT_TYPES.placeholder, {
        reason: `render threw: ${describeError(this.state.error)}`,
      });
    }
    return this.props.children;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

const silentBridge: PaywallBridge = {
  post: noop,
  subscribe: () => noop,
};

export interface RenderToNodeTreeOptions {
  /** Fixture products/variables the rendered components read. */
  config?: Partial<PaywallRuntimeConfig>;
  /** Preview state name recorded in the tree. Defaults to `"default"`. */
  state?: string;
}

/**
 * Renders `element` to a §3 preview node tree. The element is mounted with the
 * tree host components and a fixture-fed paywall runtime, committed, allowed
 * one effect pass (so hook-driven state settles), serialized, and unmounted.
 *
 * A render that throws yields a `{ type: "placeholder" }` root carrying the
 * error message; a render that produces nothing yields a placeholder with
 * reason `"render returned null"`.
 */
export const renderToNodeTree = async (
  element: ReactNode,
  options: RenderToNodeTreeOptions = {},
): Promise<PaywallNodeTree> => {
  const container: TreeContainer = { children: [] };
  let uncaught: unknown;
  let sawUncaught = false;

  const root = reconciler.createContainer(
    container,
    ConcurrentRoot,
    null,
    false,
    null,
    "vh",
    (error: unknown) => {
      uncaught = error;
      sawUncaught = true;
    },
    noop,
    noop,
    null,
  );

  const wrapped = (
    <RendererProvider host={treeHostComponents} motion={staticMotionPlatformAdapter}>
      <PaywallRuntimeProvider
        bridge={silentBridge}
        config={normalizeRuntimeConfig(options.config)}
      >
        <TreeErrorBoundary>{element}</TreeErrorBoundary>
      </PaywallRuntimeProvider>
    </RendererProvider>
  );

  await new Promise<void>((resolve) => {
    reconciler.updateContainer(wrapped, root, null, () => resolve());
  });
  // Let passive effects (and any state updates they schedule) settle before
  // reading the committed tree. A passive effect's `setState` schedules a commit
  // handled by the shared React scheduler asynchronously; a single `setTimeout`
  // can read the tree before that commit lands when another reconciler (a live
  // panel session, another concurrent render) contends for the scheduler.
  // Interleave a passive-effect flush with a macrotask and stop only once two
  // consecutive flushes report no work — settling then waits for the async
  // commit deterministically rather than racing one timer. Bounded.
  for (let i = 0; i < 20; i++) {
    const flushed = reconciler.flushPassiveEffects();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    if (!flushed && !reconciler.flushPassiveEffects()) break;
  }

  const tree: PaywallNodeTree = {
    treeVersion: PAYWALL_TREE_VERSION,
    state: options.state ?? "default",
    root: sawUncaught
      ? {
          type: "placeholder",
          reason: `render threw: ${describeError(uncaught)}`,
        }
      : serializeRoot(container),
  };

  await new Promise<void>((resolve) => {
    reconciler.updateContainer(null, root, null, () => resolve());
  });

  return tree;
};

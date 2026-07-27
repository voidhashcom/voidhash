/**
 * The long-lived panel reconciler: a `react-reconciler` mutation-mode host that
 * keeps ONE container per session (unlike the one-shot preview renderer in
 * `tree-renderer/render-to-node-tree`). It assigns each host instance a stable
 * monotonic numeric id and registers it in a `Map` so:
 *
 * - re-renders reuse instances (mutation mode) → ids are stable while a node is
 *   mounted (the host gets stable React keys for free), and
 * - {@link dispatchEvent} can look up a live instance by id and read its
 *   CURRENT handler prop.
 *
 * On every commit it schedules ONE microtask that serializes the tree and
 * emits it (coalescing multiple synchronous commits into a single emission).
 * Event dispatch runs the handler at discrete priority via the reconciler's
 * `flushSyncFromReconciler`, so a `setState` inside the handler is committed —
 * and the resulting tree emitted — before `dispatchEvent` returns.
 */
import { type ReactNode } from "react";
import createReconciler from "react-reconciler";
// The explicit ".js" matters: react-reconciler ships no `exports` map.
import { ConcurrentRoot, DefaultEventPriority } from "react-reconciler/constants.js";

/** A live host instance in the panel tree. */
export interface PanelInstance {
  readonly tag: "instance";
  readonly id: number;
  readonly type: string;
  props: Record<string, unknown>;
  children: PanelChild[];
}

/** A child in the panel tree: another instance or raw text (invalid, dropped). */
export type PanelChild = PanelInstance | string;

interface TextInstance {
  readonly tag: "text";
  readonly id: number;
  text: string;
}

interface PanelContainer {
  children: PanelChild[];
}

const noop = (): void => {
  // intentionally empty
};

const removeFrom = (list: PanelChild[], child: PanelChild): void => {
  const index = list.indexOf(child);
  if (index >= 0) list.splice(index, 1);
};

const insertInto = (list: PanelChild[], child: PanelChild, before: PanelChild): void => {
  removeFrom(list, child);
  const index = list.indexOf(before);
  list.splice(index < 0 ? list.length : index, 0, child);
};

// React 19 asserts host context is non-null; a shared sentinel stands in.
const HOST_CONTEXT: Record<string, never> = {};

/**
 * Builds a fresh reconciler + container with its own instance registry and id
 * counter. Each session gets its own so concurrent sessions never share ids or
 * priority state.
 */
export const createPanelReconciler = () => {
  const container: PanelContainer = { children: [] };
  const instances = new Map<number, PanelInstance>();
  let nextId = 0;
  let currentUpdatePriority = 0;

  // A text instance never becomes a panel node; keep its text as a raw-string
  // child so the serializer can warn+drop it. (Panel authors use props, not
  // JSX text.)
  const toChild = (child: PanelChild | TextInstance): PanelChild =>
    typeof child === "object" && "tag" in child && child.tag === "text"
      ? (child as TextInstance).text
      : (child as PanelChild);

  // Filled by `attach`; the container commit hook forwards to it.
  let onCommit: () => void = noop;

  const reconciler = createReconciler<PanelContainer>({
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

    createInstance: (type: string, props: Record<string, unknown>): PanelInstance => {
      const instance: PanelInstance = {
        tag: "instance",
        id: nextId++,
        type,
        props,
        children: [],
      };
      instances.set(instance.id, instance);
      return instance;
    },
    createTextInstance: (text: string): TextInstance => ({ tag: "text", id: nextId++, text }),
    shouldSetTextContent: () => false,
    finalizeInitialChildren: () => false,
    getRootHostContext: () => HOST_CONTEXT,
    getChildHostContext: (parentContext: unknown) => parentContext,
    getPublicInstance: (instance: unknown) => instance,

    appendInitialChild: (parent: PanelInstance, child: PanelChild | TextInstance) => {
      parent.children.push(toChild(child));
    },
    appendChild: (parent: PanelInstance, child: PanelChild | TextInstance) => {
      parent.children.push(toChild(child));
    },
    appendChildToContainer: (c: PanelContainer, child: PanelChild | TextInstance) => {
      c.children.push(toChild(child));
    },
    insertBefore: (
      parent: PanelInstance,
      child: PanelChild | TextInstance,
      before: PanelChild | TextInstance,
    ) => {
      insertInto(parent.children, toChild(child), toChild(before));
    },
    insertInContainerBefore: (
      c: PanelContainer,
      child: PanelChild | TextInstance,
      before: PanelChild | TextInstance,
    ) => {
      insertInto(c.children, toChild(child), toChild(before));
    },
    removeChild: (parent: PanelInstance, child: PanelChild | TextInstance) => {
      removeFrom(parent.children, toChild(child));
    },
    removeChildFromContainer: (c: PanelContainer, child: PanelChild | TextInstance) => {
      removeFrom(c.children, toChild(child));
    },
    clearContainer: (c: PanelContainer) => {
      c.children = [];
    },
    commitUpdate: (
      instance: PanelInstance,
      _type: string,
      _prev: Record<string, unknown>,
      next: Record<string, unknown>,
    ) => {
      instance.props = next;
    },
    commitTextUpdate: (instance: TextInstance, _old: string, next: string) => {
      instance.text = next;
    },
    resetTextContent: noop,

    prepareForCommit: () => null,
    resetAfterCommit: () => {
      onCommit();
    },
    preparePortalMount: noop,
    hideInstance: noop,
    unhideInstance: noop,
    hideTextInstance: noop,
    unhideTextInstance: noop,
    // Drop detached instances from the registry so a stale event can never
    // resolve to an unmounted node (its id is also freed for reuse-safety: the
    // monotonic counter never reissues it while mounted).
    detachDeletedInstance: (instance: PanelInstance | TextInstance) => {
      instances.delete(instance.id);
    },
    commitMount: noop,
    getInstanceFromNode: () => null,
    getInstanceFromScope: () => null,
    prepareScopeUpdate: noop,
    beforeActiveInstanceBlur: noop,
    afterActiveInstanceBlur: noop,

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

    maySuspendCommit: () => false,
    preloadInstance: () => true,
    startSuspendingCommit: noop,
    suspendInstance: noop,
    waitForCommitToBeReady: () => null,
    NotPendingTransition: null,
    resetFormInstance: noop,
  });

  const attach = (handlers: { onCommit: () => void }): void => {
    onCommit = handlers.onCommit;
  };

  return { reconciler, container, instances, attach, ConcurrentRoot };
};

/** Renders `element` into the session container. */
export type PanelReconcilerHandle = ReturnType<typeof createPanelReconciler>;

export type { ReactNode };

/**
 * Serializes the panel reconciler's live instance tree into the {@link PanelTree}
 * wire format. Mirrors the discipline of `tree-renderer/render-to-node-tree`'s
 * serializer: it maps each `vh-panel-*` intrinsic instance back to its wire
 * node `type`, splits props into serializable data props and event names, and
 * enforces the closed vocabulary — anything a definition emits outside it is
 * dropped (with a dev-mode warning) rather than trusted, because the tree
 * crosses a trust boundary and the host validates it strictly.
 *
 * Function-valued props are NOT serialized: a function whose name is in the
 * node type's event allowlist becomes an entry in `events`; a function outside
 * the allowlist is dropped with a warning. Non-clonable, non-function values
 * (symbols, class instances, `undefined`) are dropped; strings/numbers/booleans
 * /null/plain-objects/arrays pass through.
 */
import {
  PANEL_NODE_SPECS,
  type PanelJsonValue,
  type PanelNode,
  type PanelNodeType,
  type PanelRootNode,
} from "../schema/panel-tree";
import { PANEL_ELEMENT_TO_TYPE } from "./intrinsics";
import type { PanelInstance } from "./reconciler";

const isDev = process.env.NODE_ENV !== "production";

const warn = (message: string): void => {
  if (isDev) {
    // dev-only diagnostic for panel authors.
    console.warn(`[@voidhash/paywalls/panel] ${message}`);
  }
};

/** Per-type allowed prop-key sets, derived from {@link PANEL_NODE_SPECS}. */
const NODE_PROP_KEYS: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries(PANEL_NODE_SPECS).map(([type, spec]) => [type, new Set(spec.props)]),
);

/** Per-type allowed event-name sets, derived from {@link PANEL_NODE_SPECS}. */
const NODE_EVENT_NAMES: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries(PANEL_NODE_SPECS).map(([type, spec]) => [type, new Set(spec.events)]),
);

/**
 * Recursively coerces an arbitrary prop value into a {@link PanelJsonValue},
 * dropping anything non-clonable. Returns `undefined` for a value that cannot
 * be represented (which the caller omits from `props`).
 */
const toJsonValue = (value: unknown, keyPath: string): PanelJsonValue | undefined => {
  if (value === null) return null;
  const t = typeof value;
  if (t === "string" || t === "boolean") return value as PanelJsonValue;
  if (t === "number") return Number.isFinite(value as number) ? (value as number) : undefined;
  if (Array.isArray(value)) {
    const out: PanelJsonValue[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = toJsonValue(value[i], `${keyPath}[${i}]`);
      // Preserve positional arrays: an unrepresentable item becomes null rather
      // than shifting indices.
      out.push(item === undefined ? null : item);
    }
    return out;
  }
  if (t === "object") {
    // Reject class instances / exotic objects — only plain objects clone safely.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      warn(`prop "${keyPath}" is a non-plain object and was dropped`);
      return undefined;
    }
    const out: Record<string, PanelJsonValue> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const coerced = toJsonValue(child, `${keyPath}.${key}`);
      if (coerced !== undefined) {
        out[key] = coerced;
      }
    }
    return out;
  }
  // function / symbol / bigint / undefined — not representable.
  return undefined;
};

/**
 * Serializes one instance's props into `{ props, events }`, enforcing the
 * node type's closed prop-key and event-name allowlists.
 */
const serializeProps = (
  type: PanelNodeType,
  props: Record<string, unknown>,
): { props: Record<string, PanelJsonValue>; events: string[] } => {
  const allowedProps = NODE_PROP_KEYS[type]!;
  const allowedEvents = NODE_EVENT_NAMES[type]!;
  const outProps: Record<string, PanelJsonValue> = {};
  const events: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    if (key === "children") continue;
    if (typeof value === "function") {
      if (allowedEvents.has(key)) {
        events.push(key);
      } else {
        warn(`function prop "${key}" on <${type}> is not a known event and was dropped`);
      }
      continue;
    }
    if (value === undefined) continue;
    if (!allowedProps.has(key)) {
      warn(`prop "${key}" on <${type}> is not in its allowlist and was dropped`);
      continue;
    }
    const coerced = toJsonValue(value, key);
    if (coerced !== undefined) {
      outProps[key] = coerced;
    }
  }

  return { props: outProps, events };
};

/** Serializes one instance and its descendants into a {@link PanelNode}. */
const serializeInstance = (instance: PanelInstance): PanelNode => {
  const type = PANEL_ELEMENT_TO_TYPE[instance.type];
  if (type === undefined) {
    // Unreachable through the typed primitives; guard for raw-intrinsic authors.
    warn(`unknown panel element "${instance.type}" was replaced with an empty callout`);
    return { type: "callout", id: instance.id, props: {}, events: [] };
  }
  const spec = PANEL_NODE_SPECS[type];
  const { props, events } = serializeProps(type, instance.props);
  const node: {
    type: PanelNodeType;
    id: number;
    props: Record<string, PanelJsonValue>;
    events: string[];
    children?: PanelNode[];
  } = { type, id: instance.id, props, events };
  if (spec.children) {
    node.children = serializeChildren(instance.children);
  } else if (instance.children.length > 0) {
    warn(`<${type}> does not accept children; ${instance.children.length} dropped`);
  }
  return node as PanelNode;
};

const serializeChildren = (children: ReadonlyArray<PanelInstance | string>): PanelNode[] => {
  const out: PanelNode[] = [];
  for (const child of children) {
    if (typeof child === "string") {
      // Raw JSX text (e.g. a bare string) is not a panel element — text belongs
      // in a `content`/`message` prop per the wire contract.
      if (child.trim().length > 0) {
        warn(`raw text child "${child.trim().slice(0, 24)}…" is not a panel element and was dropped`);
      }
      continue;
    }
    out.push(serializeInstance(child));
  }
  return out;
};

/**
 * Serializes the container's children into the root. Exactly one `panel` child
 * is expected; `onInvalidRoot` is called (with a reason) when the shape is
 * wrong so the session can emit its fallback tree.
 */
export const serializeRoot = (
  children: ReadonlyArray<PanelInstance | string>,
  onInvalidRoot: (reason: string) => PanelRootNode,
): PanelRootNode => {
  const elements = children.filter(
    (child): child is PanelInstance => typeof child !== "string",
  );
  if (elements.length !== 1) {
    return onInvalidRoot(
      elements.length === 0 ? "panel rendered nothing" : "panel has more than one root element",
    );
  }
  const only = elements[0]!;
  if (PANEL_ELEMENT_TO_TYPE[only.type] !== "panel") {
    return onInvalidRoot("panel root must be a <Panel> element");
  }
  return serializeInstance(only) as PanelRootNode;
};

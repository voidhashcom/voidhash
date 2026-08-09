/**
 * Dependency-free runtime validator for the editor {@link PanelTree} wire
 * format. Mirrors {@link parsePreviewTree} in `./validate` — same result shape,
 * same strictness discipline, no `effect`, no `react`.
 *
 * The panel channel is a trust boundary: author JS produces this tree inside a
 * sandbox and the host renders it with real components. Everything outside the
 * closed v1 vocabulary is rejected — unknown node types, unknown prop keys per
 * type, event names outside a type's allowlist, children on childless types,
 * duplicate or malformed `id`s, and any resource cap in {@link PANEL_CAPS}.
 */
import {
  PANEL_CAPS,
  PANEL_ICON_NAME_LIST,
  PANEL_NODE_SPECS,
  PANEL_TREE_VERSION,
  type PanelTree,
} from "./panel-tree";

/** Discriminated result of {@link parsePanelTree}. */
export type ParsePanelResult =
  | { readonly ok: true; readonly tree: PanelTree }
  | { readonly ok: false; readonly error: string };

/** Icon tokens as a runtime `Set`, single-sourced from {@link PANEL_ICON_NAME_LIST}. */
export const PANEL_ICON_NAMES: ReadonlySet<string> = new Set(PANEL_ICON_NAME_LIST);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Per-type allowed prop-key sets, derived from {@link PANEL_NODE_SPECS}. */
const NODE_PROP_KEYS: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries(PANEL_NODE_SPECS).map(([type, spec]) => [type, new Set(spec.props)]),
);

/** Per-type allowed event-name sets, derived from {@link PANEL_NODE_SPECS}. */
const NODE_EVENT_NAMES: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries(PANEL_NODE_SPECS).map(([type, spec]) => [type, new Set(spec.events)]),
);

/**
 * Recursively checks any nested `props` value against the string-length,
 * options-count, and gradient-stops caps. `keyForCap` names the array key that
 * carries an options/stops cap so nested arrays under it are counted.
 */
const checkValueCaps = (value: unknown, path: string, keyForCap: string | null): string | null => {
  if (typeof value === "string") {
    if (value.length > PANEL_CAPS.stringLength) {
      return `${path} string exceeds ${PANEL_CAPS.stringLength} chars`;
    }
    return null;
  }
  if (Array.isArray(value)) {
    if (keyForCap === "options" && value.length > PANEL_CAPS.options) {
      return `${path} exceeds ${PANEL_CAPS.options} options`;
    }
    if (keyForCap === "stops" && value.length > PANEL_CAPS.gradientStops) {
      return `${path} exceeds ${PANEL_CAPS.gradientStops} gradient stops`;
    }
    for (let i = 0; i < value.length; i++) {
      const error = checkValueCaps(value[i], `${path}[${i}]`, keyForCap);
      if (error !== null) return error;
    }
    return null;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const error = checkValueCaps(child, `${path}.${key}`, key);
      if (error !== null) return error;
    }
    return null;
  }
  return null;
};

/**
 * Validates one node in place, threading `depth`, the running node `count`, and
 * the set of ids seen so far. Returns the first error message, or `null`.
 */
const validateNode = (
  node: unknown,
  path: string,
  depth: number,
  state: { count: number; readonly ids: Set<number> },
): string | null => {
  if (depth > PANEL_CAPS.depth) {
    return `${path} exceeds max depth ${PANEL_CAPS.depth}`;
  }
  if (!isPlainObject(node)) {
    return `${path} must be an object`;
  }

  state.count += 1;
  if (state.count > PANEL_CAPS.nodes) {
    return `tree exceeds ${PANEL_CAPS.nodes} nodes`;
  }

  const type = node.type;
  if (typeof type !== "string" || !(type in PANEL_NODE_SPECS)) {
    return `${path}.type "${String(type)}" is not a known panel node type`;
  }
  const spec = PANEL_NODE_SPECS[type as keyof typeof PANEL_NODE_SPECS];

  const { id } = node;
  if (typeof id !== "number" || !Number.isInteger(id) || id < 0) {
    return `${path}.id must be a non-negative integer`;
  }
  if (state.ids.has(id)) {
    return `${path}.id ${id} is duplicated`;
  }
  state.ids.add(id);

  const allowedTopKeys = new Set(["type", "id", "props", "events", "children"]);
  for (const key of Object.keys(node)) {
    if (!allowedTopKeys.has(key)) {
      return `${path} (${type}) has unknown key "${key}"`;
    }
  }

  // props
  if (!isPlainObject(node.props)) {
    return `${path}.props must be an object`;
  }
  const allowedProps = NODE_PROP_KEYS[type]!;
  for (const [key, value] of Object.entries(node.props)) {
    if (!allowedProps.has(key)) {
      return `${path} (${type}) has unknown prop "${key}"`;
    }
    if (key === "icon" && value !== undefined && value !== null) {
      if (typeof value !== "string" || !PANEL_ICON_NAMES.has(value)) {
        return `${path}.props.icon ${JSON.stringify(value)} is not a known icon token`;
      }
    }
    const capError = checkValueCaps(value, `${path}.props.${key}`, key);
    if (capError !== null) return capError;
  }

  // events
  if (!Array.isArray(node.events)) {
    return `${path}.events must be an array`;
  }
  if (node.events.length > PANEL_CAPS.eventsPerNode) {
    return `${path}.events exceeds ${PANEL_CAPS.eventsPerNode} events`;
  }
  const allowedEvents = NODE_EVENT_NAMES[type]!;
  const seenEvents = new Set<string>();
  for (const event of node.events) {
    if (typeof event !== "string") {
      return `${path}.events must contain only strings`;
    }
    if (!allowedEvents.has(event)) {
      return `${path} (${type}) has event "${event}" not in its allowlist`;
    }
    if (seenEvents.has(event)) {
      return `${path}.events has duplicate event "${event}"`;
    }
    seenEvents.add(event);
  }

  // children
  if (spec.children) {
    if (!Array.isArray(node.children)) {
      return `${path}.children must be an array`;
    }
    for (let i = 0; i < node.children.length; i++) {
      const error = validateNode(node.children[i], `${path}.children[${i}]`, depth + 1, state);
      if (error !== null) return error;
    }
  } else if (node.children !== undefined) {
    return `${path} (${type}) does not allow children`;
  }

  return null;
};

/**
 * Strictly validates an unknown value (or serialized string) as a
 * {@link PanelTree}. Enforces envelope `version`, a `panel` root, the closed
 * per-type prop/event vocabulary, unique non-negative-integer ids, and every
 * cap in {@link PANEL_CAPS}. When given a string, the raw byte length is
 * pre-checked against the tree-byte cap before parsing.
 */
export const parsePanelTree = (input: unknown): ParsePanelResult => {
  let value: unknown = input;
  if (typeof input === "string") {
    if (byteLength(input) > PANEL_CAPS.treeBytes) {
      return { ok: false, error: `tree exceeds ${PANEL_CAPS.treeBytes} bytes` };
    }
    try {
      value = JSON.parse(input);
    } catch {
      return { ok: false, error: "tree is not valid JSON" };
    }
  }

  if (!isPlainObject(value)) {
    return { ok: false, error: "tree must be an object" };
  }
  for (const key of Object.keys(value)) {
    if (key !== "version" && key !== "root") {
      return { ok: false, error: `tree has unknown key "${key}"` };
    }
  }
  if (value.version !== PANEL_TREE_VERSION) {
    return { ok: false, error: `tree.version must be ${PANEL_TREE_VERSION}` };
  }
  if (!isPlainObject(value.root)) {
    return { ok: false, error: "tree.root must be an object" };
  }
  if (value.root.type !== "panel") {
    return { ok: false, error: 'tree.root.type must be "panel"' };
  }

  const state = { count: 0, ids: new Set<number>() };
  const error = validateNode(value.root, "tree.root", 1, state);
  if (error !== null) {
    return { ok: false, error };
  }
  return { ok: true, tree: value as unknown as PanelTree };
};

/**
 * UTF-8 byte length of a string without depending on `Buffer` or `TextEncoder`
 * availability (both may be absent in a bare sandbox global scope): prefer
 * `TextEncoder`, fall back to a manual code-point count.
 */
const byteLength = (input: string): number => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(input).length;
  }
  let bytes = 0;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
};

/**
 * Dependency-free runtime validators for the paywall deploy wire formats.
 *
 * These mirror the effect-Schema decoders the voidhash server applies as its
 * trust boundary (`packages/core/src/services/paywallDeploys/PaywallDeployManifest.ts`)
 * so the CLI, studio sandbox, and any other JS consumer can validate the same
 * §2 component manifests and §3 preview trees WITHOUT pulling in `effect`.
 * Every constraint here is intentionally identical to that server decoder —
 * the mono's contract test locks the two together.
 *
 * Strictness follows `docs/specs/paywall-deploy-contract.md` §2/§3/§3.1:
 * unknown node types, unknown keys, and out-of-vocabulary style keys are all
 * rejected. No `effect`, no `react`.
 */
import { MOTION_STYLE_KEYS } from "../motion/types";
import {
  COMPONENT_MANIFEST_VERSION,
  type ComponentManifest,
  type ManifestAction,
  type ManifestArrayItem,
  type ManifestProp,
} from "./component-manifest";
import { PAYWALL_TREE_VERSION, type PaywallNode, type PaywallNodeTree } from "./node-tree";
import { PAYWALL_STYLE_KEY_LIST } from "./style";

/** Discriminated result of a validator: parsed value or a list of error messages. */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: ReadonlyArray<string> };

/**
 * The §3.1 style vocabulary as a runtime `Set`, single-sourced from
 * {@link PAYWALL_STYLE_KEY_LIST} (which is itself tied to the `PaywallStyle`
 * type). Any style key outside this set is rejected by {@link parsePreviewTree}.
 */
export const PAYWALL_STYLE_KEYS: ReadonlySet<string> = new Set(PAYWALL_STYLE_KEY_LIST);

/** `components[].previews[].state` / §3 tree `state` constraint (contract §1.1). */
export const PREVIEW_STATE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

/**
 * §2 component `id` slug constraint (contract §1.1). Mirrors the server's
 * `DeploySlug` — the server decodes `ComponentManifest.id` with this exact
 * pattern, so an id with uppercase, underscores, or length &gt; 64 is rejected
 * at the trust boundary.
 */
export const DEPLOY_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

const NODE_TYPES = new Set(["view", "text", "image", "pressable", "scroll", "slot", "placeholder"]);
const RESIZE_MODES = new Set(["cover", "contain", "stretch", "center"]);
const PROP_KINDS = new Set([
  "string",
  "number",
  "boolean",
  "select",
  "image",
  "ref",
  "component",
  "array",
]);
const ACTION_PAYLOAD_KINDS = new Set(["string", "number", "boolean"]);
const HOST_DATA_VALUES = new Set(["products"]);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

/** Keys present on `value` that are not in `allowed`. */
const unknownKeys = (value: Record<string, unknown>, allowed: ReadonlySet<string>): string[] =>
  Object.keys(value).filter((key) => !allowed.has(key));

// =============================================================================
// §3 Preview node tree
// =============================================================================

const STYLE_VALUE_LABEL = "a number or string";

const BACKGROUND_TYPES = new Set(["solid", "gradient", "image"]);
const GRADIENT_KINDS = new Set(["linear", "radial"]);
const MOTION_STYLE_KEY_SET: ReadonlySet<string> = new Set(MOTION_STYLE_KEYS);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Structurally validates a `backgroundGradient` style value (contract §3.1). */
const validateBackgroundGradient = (value: unknown, path: string, errors: string[]): void => {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const key of unknownKeys(
    value,
    new Set(["kind", "startX", "startY", "endX", "endY", "stops"]),
  )) {
    errors.push(`${path} has unknown key "${key}"`);
  }
  if (typeof value.kind !== "string" || !GRADIENT_KINDS.has(value.kind)) {
    errors.push(`${path}.kind must be one of linear, radial`);
  }
  for (const coord of ["startX", "startY", "endX", "endY"] as const) {
    if (!isFiniteNumber(value[coord])) {
      errors.push(`${path}.${coord} must be a finite number`);
    }
  }
  if (!Array.isArray(value.stops)) {
    errors.push(`${path}.stops must be an array`);
  } else {
    value.stops.forEach((stop, index) => {
      const stopPath = `${path}.stops[${index}]`;
      if (!isPlainObject(stop)) {
        errors.push(`${stopPath} must be an object`);
        return;
      }
      for (const key of unknownKeys(stop, new Set(["color", "position"]))) {
        errors.push(`${stopPath} has unknown key "${key}"`);
      }
      if (typeof stop.color !== "string") {
        errors.push(`${stopPath}.color must be a string`);
      }
      if (!isFiniteNumber(stop.position)) {
        errors.push(`${stopPath}.position must be a finite number`);
      }
    });
  }
};

/** Structurally validates a `backgroundImage` style value (contract §3.1). */
const validateBackgroundImage = (value: unknown, path: string, errors: string[]): void => {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const key of unknownKeys(value, new Set(["url", "resizeMode"]))) {
    errors.push(`${path} has unknown key "${key}"`);
  }
  if (typeof value.url !== "string") {
    errors.push(`${path}.url must be a string`);
  }
  if (typeof value.resizeMode !== "string" || !RESIZE_MODES.has(value.resizeMode)) {
    errors.push(`${path}.resizeMode must be one of cover, contain, stretch, center`);
  }
};

const validateStyle = (style: unknown, path: string, errors: string[]): void => {
  if (!isPlainObject(style)) {
    errors.push(`${path}.style must be an object`);
    return;
  }
  for (const [key, value] of Object.entries(style)) {
    if (!PAYWALL_STYLE_KEYS.has(key)) {
      errors.push(`${path}.style has unknown key "${key}"`);
      continue;
    }
    // The structured background keys carry object values; everything else in the
    // §3.1 vocabulary is a number or string (colors, "50%"); no arbitrary CSS.
    if (key === "backgroundType") {
      if (typeof value !== "string" || !BACKGROUND_TYPES.has(value)) {
        errors.push(`${path}.style.backgroundType must be one of solid, gradient, image`);
      }
    } else if (key === "backgroundGradient") {
      validateBackgroundGradient(value, `${path}.style.backgroundGradient`, errors);
    } else if (key === "backgroundImage") {
      validateBackgroundImage(value, `${path}.style.backgroundImage`, errors);
    } else if (typeof value !== "number" && typeof value !== "string") {
      errors.push(`${path}.style.${key} must be ${STYLE_VALUE_LABEL}`);
    }
  }
};

const validateMotion = (motion: unknown, path: string, errors: string[]): void => {
  if (!isPlainObject(motion)) {
    errors.push(`${path}.motion must be an object`);
    return;
  }
  for (const [key, value] of Object.entries(motion)) {
    if (!MOTION_STYLE_KEY_SET.has(key)) {
      errors.push(`${path}.motion has unknown key "${key}"`);
    } else if (key === "backgroundColor") {
      if (typeof value !== "string") {
        errors.push(`${path}.motion.backgroundColor must be a string`);
      }
    } else if (key === "transformOrigin") {
      if (!isPlainObject(value)) {
        errors.push(`${path}.motion.transformOrigin must be an object`);
      } else {
        for (const originKey of unknownKeys(value, new Set(["x", "y"]))) {
          errors.push(`${path}.motion.transformOrigin has unknown key "${originKey}"`);
        }
        if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
          errors.push(`${path}.motion.transformOrigin.x and .y must be finite numbers`);
        }
      }
    } else if (!isFiniteNumber(value)) {
      errors.push(`${path}.motion.${key} must be a finite number`);
    }
  }
};

const NODE_KEYS: Record<string, ReadonlySet<string>> = {
  view: new Set(["type", "style", "motion", "children"]),
  scroll: new Set(["type", "style", "motion", "children"]),
  pressable: new Set(["type", "style", "motion", "children", "action"]),
  text: new Set(["type", "style", "motion", "text"]),
  image: new Set(["type", "style", "motion", "src", "resizeMode"]),
  slot: new Set(["type"]),
  placeholder: new Set(["type", "reason"]),
};

const validateNode = (node: unknown, path: string, errors: string[]): void => {
  if (!isPlainObject(node)) {
    errors.push(`${path} must be an object`);
    return;
  }
  const type = node.type;
  if (typeof type !== "string" || !NODE_TYPES.has(type)) {
    errors.push(`${path}.type "${String(type)}" is not a known node type`);
    return;
  }
  for (const key of unknownKeys(node, NODE_KEYS[type]!)) {
    errors.push(`${path} (${type}) has unknown key "${key}"`);
  }

  switch (type) {
    case "view":
    case "scroll":
    case "pressable": {
      validateStyle(node.style, path, errors);
      if (node.motion !== undefined) {
        validateMotion(node.motion, path, errors);
      }
      if (!Array.isArray(node.children)) {
        errors.push(`${path}.children must be an array`);
      } else {
        node.children.forEach((child, index) =>
          validateNode(child, `${path}.children[${index}]`, errors),
        );
      }
      if (type === "pressable" && node.action !== undefined && typeof node.action !== "string") {
        errors.push(`${path}.action must be a string`);
      }
      return;
    }
    case "text": {
      validateStyle(node.style, path, errors);
      if (node.motion !== undefined) {
        validateMotion(node.motion, path, errors);
      }
      if (typeof node.text !== "string") {
        errors.push(`${path}.text must be a string`);
      }
      return;
    }
    case "image": {
      validateStyle(node.style, path, errors);
      if (node.motion !== undefined) {
        validateMotion(node.motion, path, errors);
      }
      if (typeof node.src !== "string") {
        errors.push(`${path}.src must be a string`);
      }
      if (node.resizeMode !== undefined && !RESIZE_MODES.has(node.resizeMode as string)) {
        errors.push(
          `${path}.resizeMode ${JSON.stringify(node.resizeMode)} must be one of cover, contain, stretch, center`,
        );
      }
      return;
    }
    case "placeholder": {
      if (typeof node.reason !== "string") {
        errors.push(`${path}.reason must be a string`);
      }
      return;
    }
    // `slot` carries nothing else; the unknown-key check above is sufficient.
  }
};

/**
 * Strictly validates an unknown value as a §3 {@link PaywallNodeTree}. Rejects
 * unknown node types, unknown keys on any node, out-of-vocabulary style keys,
 * a `treeVersion` other than the current one, and a `state` that violates the
 * §1.1 pattern. Returns the value narrowed to `PaywallNodeTree` on success.
 */
export const parsePreviewTree = (input: unknown): ParseResult<PaywallNodeTree> => {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, errors: ["tree must be an object"] };
  }
  for (const key of unknownKeys(input, new Set(["treeVersion", "state", "root"]))) {
    errors.push(`tree has unknown key "${key}"`);
  }
  if (input.treeVersion !== PAYWALL_TREE_VERSION) {
    errors.push(`tree.treeVersion must be ${PAYWALL_TREE_VERSION}`);
  }
  if (typeof input.state !== "string") {
    errors.push("tree.state must be a string");
  } else if (!PREVIEW_STATE_PATTERN.test(input.state)) {
    errors.push(`tree.state "${input.state}" does not match ${PREVIEW_STATE_PATTERN}`);
  }
  if (input.root === undefined) {
    errors.push("tree.root is required");
  } else {
    validateNode(input.root, "tree.root", errors);
  }
  return errors.length === 0
    ? { ok: true, value: input as unknown as PaywallNodeTree }
    : { ok: false, errors };
};

/**
 * Counts `slot` marker nodes anywhere in a §3 preview tree. The contract
 * allows at most one; server finalize rejects trees where this exceeds 1.
 */
export const countSlotNodes = (node: PaywallNode): number => {
  switch (node.type) {
    case "slot":
      return 1;
    case "view":
    case "pressable":
    case "scroll":
      return node.children.reduce((count, child) => count + countSlotNodes(child), 0);
    default:
      return 0;
  }
};

// =============================================================================
// §2 Component manifest
// =============================================================================

// The `ref` and `component` prop schemas on the server carry NO `default` field
// (only `label`/`description`/`optional`), so their default is fixed at "—".
// Splitting the base key sets keeps a present `default` out of those two kinds,
// matching the server decoder which rejects it as an excess property.
const PROP_META_KEYS = ["kind", "label", "description", "optional"];
const PROP_COMMON_KEYS = [...PROP_META_KEYS, "default"];

/** Keys allowed on a prop definition of the given kind (contract §2). */
const propKeysFor = (kind: string): ReadonlySet<string> => {
  switch (kind) {
    case "string":
      return new Set([...PROP_COMMON_KEYS, "editor", "localizable"]);
    case "image":
      return new Set([...PROP_COMMON_KEYS, "localizable"]);
    case "select":
      return new Set([...PROP_COMMON_KEYS, "options"]);
    case "ref":
      return new Set([...PROP_META_KEYS, "refType"]);
    case "component":
      return new Set(PROP_META_KEYS);
    case "array":
      return new Set([...PROP_COMMON_KEYS, "item"]);
    default:
      return new Set(PROP_COMMON_KEYS);
  }
};

const validateCommonPropFields = (
  prop: Record<string, unknown>,
  path: string,
  errors: string[],
): void => {
  if (prop.label !== undefined && typeof prop.label !== "string") {
    errors.push(`${path}.label must be a string`);
  }
  if (prop.description !== undefined && typeof prop.description !== "string") {
    errors.push(`${path}.description must be a string`);
  }
  if (prop.optional !== undefined && typeof prop.optional !== "boolean") {
    errors.push(`${path}.optional must be a boolean`);
  }
  // `localizable` is only an allowed key on string/image props (see
  // `propKeysFor`); its value, when present, must be a boolean.
  if (prop.localizable !== undefined && typeof prop.localizable !== "boolean") {
    errors.push(`${path}.localizable must be a boolean`);
  }
};

/**
 * Validates one prop definition. `asItem` marks an array element, which the
 * server validates identically to a top-level prop except that its `kind` may
 * not itself be `array`.
 */
const validateProp = (
  prop: unknown,
  path: string,
  errors: string[],
  options: { readonly asItem: boolean },
): void => {
  if (!isPlainObject(prop)) {
    errors.push(`${path} must be an object`);
    return;
  }
  const kind = prop.kind;
  if (typeof kind !== "string" || !PROP_KINDS.has(kind)) {
    errors.push(`${path}.kind "${String(kind)}" is not a known prop kind`);
    return;
  }
  if (options.asItem && kind === "array") {
    errors.push(`${path}.item kind must not be "array" (§2: array item is a non-array kind)`);
    return;
  }
  for (const key of unknownKeys(prop, propKeysFor(kind))) {
    errors.push(`${path} (${kind}) has unknown key "${key}"`);
  }
  // The server's `ArrayItemSchema` reuses the full per-kind prop structs, so an
  // array item accepts and TYPE-CHECKS the same common fields (label/
  // description/optional) and per-kind `default` as a top-level prop — the only
  // item-specific constraint is that its kind may not be `array` (handled
  // above). Validate them for items too, mirroring the server exactly.
  validateCommonPropFields(prop, path, errors);

  switch (kind) {
    case "string": {
      if (prop.editor !== undefined && prop.editor !== "color") {
        errors.push(`${path}.editor must be "color"`);
      }
      if (prop.default !== undefined && typeof prop.default !== "string") {
        errors.push(`${path}.default must be a string`);
      }
      return;
    }
    case "number": {
      if (prop.default !== undefined && typeof prop.default !== "number") {
        errors.push(`${path}.default must be a number`);
      }
      return;
    }
    case "boolean": {
      if (prop.default !== undefined && typeof prop.default !== "boolean") {
        errors.push(`${path}.default must be a boolean`);
      }
      return;
    }
    case "select": {
      if (
        !Array.isArray(prop.options) ||
        prop.options.length === 0 ||
        !prop.options.every((option) => typeof option === "string")
      ) {
        errors.push(`${path}.options must be a non-empty array of strings`);
      }
      if (prop.default !== undefined && typeof prop.default !== "string") {
        errors.push(`${path}.default must be a string`);
      }
      return;
    }
    case "image": {
      if (prop.default !== undefined && typeof prop.default !== "string") {
        errors.push(`${path}.default must be a string`);
      }
      return;
    }
    case "ref": {
      if (prop.refType !== "product") {
        errors.push(`${path}.refType must be "product"`);
      }
      return;
    }
    case "component":
      return;
    case "array": {
      validateProp(prop.item, `${path}.item`, errors, { asItem: true });
      if (prop.default !== undefined) {
        if (!Array.isArray(prop.default) || !prop.default.every(isScalar)) {
          errors.push(`${path}.default must be an array of string|number|boolean`);
        }
      }
      return;
    }
  }
};

const validateAction = (action: unknown, path: string, errors: string[]): void => {
  if (!isPlainObject(action)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const key of unknownKeys(action, new Set(["payload"]))) {
    errors.push(`${path} has unknown key "${key}"`);
  }
  if (!isPlainObject(action.payload)) {
    errors.push(`${path}.payload must be an object`);
    return;
  }
  for (const [field, spec] of Object.entries(action.payload)) {
    const fieldPath = `${path}.payload.${field}`;
    if (!isPlainObject(spec)) {
      errors.push(`${fieldPath} must be an object`);
      continue;
    }
    for (const key of unknownKeys(spec, new Set(["kind"]))) {
      errors.push(`${fieldPath} has unknown key "${key}"`);
    }
    if (typeof spec.kind !== "string" || !ACTION_PAYLOAD_KINDS.has(spec.kind)) {
      errors.push(`${fieldPath}.kind must be one of string, number, boolean`);
    }
  }
};

const MANIFEST_KEYS = new Set([
  "manifestVersion",
  "title",
  "description",
  "props",
  "actions",
  "slot",
  "previewStates",
  "hostData",
]);

/**
 * Strictly validates an unknown value as a §2 {@link ComponentManifest}.
 * Mirrors the server decoder: unknown top-level keys, unknown per-prop keys,
 * unknown prop/action kinds, empty `select` options, array items that are
 * themselves arrays, `editor` on a non-string prop, malformed action payload
 * kinds, non-boolean `slot`, empty `previewStates`, and out-of-subset
 * `hostData` are all rejected. A v1 (or otherwise id-bearing) manifest fails
 * the `manifestVersion` / unknown-key checks: `id` is no longer a manifest
 * field (a component is identified by its file path in the paywall document).
 */
export const parseComponentManifest = (input: unknown): ParseResult<ComponentManifest> => {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, errors: ["manifest must be an object"] };
  }
  for (const key of unknownKeys(input, MANIFEST_KEYS)) {
    errors.push(`manifest has unknown key "${key}"`);
  }
  if (input.manifestVersion !== COMPONENT_MANIFEST_VERSION) {
    errors.push(`manifest.manifestVersion must be ${COMPONENT_MANIFEST_VERSION}`);
  }
  if (input.title !== undefined && typeof input.title !== "string") {
    errors.push("manifest.title must be a string");
  }
  if (input.description !== undefined && typeof input.description !== "string") {
    errors.push("manifest.description must be a string");
  }

  if (!isPlainObject(input.props)) {
    errors.push("manifest.props must be an object");
  } else {
    for (const [name, prop] of Object.entries(input.props)) {
      validateProp(prop, `manifest.props.${name}`, errors, { asItem: false });
    }
  }

  if (input.actions !== undefined) {
    if (!isPlainObject(input.actions)) {
      errors.push("manifest.actions must be an object");
    } else {
      for (const [name, action] of Object.entries(input.actions)) {
        validateAction(action, `manifest.actions.${name}`, errors);
      }
    }
  }

  if (input.slot !== undefined && typeof input.slot !== "boolean") {
    errors.push("manifest.slot must be a boolean");
  }

  if (input.previewStates !== undefined) {
    if (
      !Array.isArray(input.previewStates) ||
      input.previewStates.length === 0 ||
      !input.previewStates.every((state) => typeof state === "string")
    ) {
      errors.push("manifest.previewStates must be a non-empty array of strings");
    } else {
      for (const state of input.previewStates) {
        if (!PREVIEW_STATE_PATTERN.test(state)) {
          errors.push(`manifest.previewStates: "${state}" does not match ${PREVIEW_STATE_PATTERN}`);
        }
      }
    }
  }

  if (input.hostData !== undefined) {
    if (!Array.isArray(input.hostData)) {
      errors.push("manifest.hostData must be an array");
    } else {
      for (const value of input.hostData) {
        if (typeof value !== "string" || !HOST_DATA_VALUES.has(value)) {
          errors.push(`manifest.hostData: "${String(value)}" is not a known host data value`);
        }
      }
    }
  }

  return errors.length === 0
    ? { ok: true, value: input as unknown as ComponentManifest }
    : { ok: false, errors };
};

export type { ManifestAction, ManifestArrayItem, ManifestProp };

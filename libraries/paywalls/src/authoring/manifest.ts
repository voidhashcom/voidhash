import type {
  ComponentManifest,
  ManifestAction,
  ManifestArrayItem,
  ManifestProp,
  ManifestPropKind,
} from "../schema/component-manifest";
import { COMPONENT_MANIFEST_VERSION } from "../schema/component-manifest";
import type { ActionMap } from "./actions";
import type { ComponentDefinition } from "./define-component";
import type { PropMap, PropSchema } from "./props";

const isJsonScalar = (value: unknown): value is string | number | boolean =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

/** Defaults are emitted only when they survive JSON serialization losslessly. */
const serializableDefault = (value: unknown): unknown => {
  if (isJsonScalar(value)) {
    return value;
  }
  if (Array.isArray(value) && value.every(isJsonScalar)) {
    return value;
  }
  return;
};

const isEmptySelect = (schema: PropSchema | undefined): boolean =>
  schema?.kind === "select" &&
  (schema.options === undefined || schema.options.length === 0);

/**
 * Rejects `p.select([])` (contract §2: select options must be non-empty) with
 * an error naming the offending component and prop, covering both top-level
 * select props and `p.array(p.select([]))` items.
 */
const assertSelectHasOptions = (
  componentId: string,
  propName: string,
  schema: PropSchema,
): void => {
  if (isEmptySelect(schema) || (schema.kind === "array" && isEmptySelect(schema.item))) {
    throw new Error(
      `Component "${componentId}": prop "${propName}" declares p.select([]) ` +
        "with no options — select props need at least one option.",
    );
  }
};

const toManifestItem = (item: PropSchema): ManifestArrayItem => ({
  kind: item.kind as Exclude<ManifestPropKind, "array">,
  ...(item.options ? { options: item.options } : {}),
  ...(item.refType ? { refType: item.refType } : {}),
  ...(item.editor ? { editor: item.editor } : {}),
});

const toManifestProp = (schema: PropSchema): ManifestProp => {
  const defaultValue = schema.hasDefault
    ? serializableDefault(schema.defaultValue)
    : undefined;
  const entry = {
    kind: schema.kind,
    ...(schema.kind === "select" && schema.options
      ? { options: schema.options }
      : {}),
    ...(schema.kind === "ref" && schema.refType
      ? { refType: schema.refType }
      : {}),
    ...(schema.kind === "array" && schema.item
      ? { item: toManifestItem(schema.item) }
      : {}),
    ...(schema.label !== undefined ? { label: schema.label } : {}),
    ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    ...(schema.editor !== undefined ? { editor: schema.editor } : {}),
    // A prop with a default is omittable for consumers, so the manifest
    // reports it as optional even without an explicit `.optional()`.
    optional: schema.optional || schema.hasDefault,
  };
  // Safe: `kind` discriminates the union but TS cannot narrow a value built
  // with conditional spreads; the per-kind fields above match the schema.
  return entry as ManifestProp;
};

/**
 * Heuristic slot detection: the compiled template source references the `Slot`
 * identifier (as `jsx(Slot, …)`, `(0, paywalls.Slot)(…)`, …). False negatives
 * are possible if the import is renamed (`Slot as Foo`); renaming `Slot` is
 * therefore unsupported in component templates.
 */
const detectSlotUsage = (render: (ctx: never) => unknown): boolean =>
  /\bSlot\b/.test(String(render));

/**
 * Heuristic product-hook detection, mirroring {@link detectSlotUsage}: the
 * compiled template source references one of the runtime hooks that read
 * injected products. `usePaywallConfig` is included loosely — it returns the
 * full config (products included), so a false positive merely over-injects
 * products, which is harmless while `"products"` is the only legal hostData
 * value. Same limitation as slot detection: hooks called inside local helper
 * components outside the template function, or renamed imports, are not
 * detected.
 */
const detectProductHookUsage = (render: (ctx: never) => unknown): boolean =>
  /\b(usePaywallProducts|useSelectedProduct|usePaywallConfig)\b/.test(
    String(render),
  );

/**
 * Extracts the §2 component manifest from a {@link ComponentDefinition}. Runs
 * in the CLI's local node process at build time — never on the server.
 *
 * Heuristics (documented behaviour):
 * - `slot` — true when the template source references the `Slot` identifier.
 * - `hostData` — `["products"]` when any preview state declares product data,
 *   any prop is `p.ref("product")`, or the template source references a
 *   product-reading runtime hook (`usePaywallProducts`, `useSelectedProduct`,
 *   `usePaywallConfig`); otherwise `[]`. The hook check shares slot
 *   detection's source-regex limitation: renamed imports or hooks called only
 *   in helper components defined outside the template are not detected.
 * - `previewStates` — the declared preview names, or `["default"]` when the
 *   definition declares none (the CLI renders an implicit fixture-less state).
 */
export const extractComponentManifest = <
  M extends PropMap,
  A extends ActionMap,
>(
  definition: ComponentDefinition<M, A>,
): ComponentManifest => {
  const props: Record<string, ManifestProp> = {};
  for (const [name, builder] of Object.entries(definition.props)) {
    assertSelectHasOptions(definition.id, name, builder.schema);
    props[name] = toManifestProp(builder.schema);
  }

  const actions: Record<string, ManifestAction> = {};
  for (const [name, builder] of Object.entries(definition.actions)) {
    const payload: Record<string, { kind: "string" | "number" | "boolean" }> =
      {};
    for (const [field, fieldBuilder] of Object.entries(
      builder.payloadShape ?? {},
    )) {
      payload[field] = { kind: fieldBuilder.kind };
    }
    actions[name] = { payload };
  }

  const previewNames = Object.keys(definition.previews);
  const usesProducts =
    Object.values(definition.props).some(
      (builder) =>
        builder.schema.kind === "ref" && builder.schema.refType === "product",
    ) ||
    Object.values(definition.previews).some(
      (preview) => preview.data?.products !== undefined,
    ) ||
    detectProductHookUsage(definition.render);

  return {
    manifestVersion: COMPONENT_MANIFEST_VERSION,
    id: definition.id,
    ...(definition.title !== undefined ? { title: definition.title } : {}),
    ...(definition.description !== undefined
      ? { description: definition.description }
      : {}),
    props,
    actions,
    slot: detectSlotUsage(definition.render),
    previewStates: previewNames.length > 0 ? previewNames : ["default"],
    hostData: usesProducts ? ["products"] : [],
  };
};

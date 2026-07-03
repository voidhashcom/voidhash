/**
 * Code-component instance support for the composition format.
 *
 * The base grammar (Screen/View/Text) is self-contained, but a `<Component>`
 * element has no meaning without knowing which component it refers to and what
 * props/actions that component declares. That knowledge lives in the caller's
 * mimic document (the `codeComponent` definitions + their compiled manifests),
 * so it is threaded into the parser/printer as a {@link CompositionRegistry}
 * rather than hardcoded here.
 *
 * The composition manifest types are derived from `@voidhash/paywalls/schema`'s
 * §2 {@link ComponentManifest} rather than re-declared: every shared field's
 * type traces back to the schema manifest by construction. This makes a real
 * `ComponentManifest` assignable to {@link CompositionComponentManifest} by
 * type, not by convention — a shape change in the schema is either inherited
 * here automatically or surfaces as a compile error, never silent drift.
 */

import type {
  ComponentManifest,
  ManifestAction,
  ManifestArrayProp,
  ManifestProp,
  ManifestPropKind,
  ManifestRefProp,
  ManifestSelectProp,
} from "../schema/component-manifest";

/** Prop kinds a component manifest can declare (the §2 manifest prop kinds). */
export type CompositionPropKind = ManifestPropKind;

/**
 * The subset of a manifest prop definition the composition layer consumes: an
 * all-optional projection of the {@link ManifestProp} union whose field types
 * are single-sourced from that union's members, so they cannot drift from the
 * schema. `item` recurses to this projected type (the composition-level view of
 * {@link ManifestArrayProp}'s `item`) rather than the schema's `ManifestArrayItem`.
 */
export interface CompositionPropDef {
  readonly kind: ManifestProp["kind"];
  readonly refType?: ManifestRefProp["refType"];
  readonly options?: ManifestSelectProp["options"];
  readonly optional?: ManifestProp["optional"];
  readonly item?: CompositionPropDef;
}

/**
 * The manifest action definition the composition layer consumes. Identical to
 * the schema's {@link ManifestAction}, so it is aliased directly.
 */
export type CompositionActionDef = ManifestAction;

/**
 * The manifest keys the composition layer reads, resolved off the real
 * {@link ComponentManifest} so a rename in the schema drops them here and trips
 * the {@link _CompositionManifestKeysExist} guard below.
 */
type CompositionManifestKey = Extract<keyof ComponentManifest, "props" | "actions" | "slot">;

/**
 * The subset of a component's {@link ComponentManifest} (`@voidhash/paywalls/schema`)
 * the composition layer needs. The field-key set is single-sourced from the
 * schema manifest ({@link CompositionManifestKey}) and `slot` reuses the
 * manifest's own type via `Pick`; only the record value types are the wider
 * composition projection ({@link CompositionPropDef} / {@link CompositionActionDef}),
 * since a composition manifest is a real manifest read through a looser lens. A
 * real `ComponentManifest` is assignable to this by construction (asserted by
 * {@link _ManifestIsCompositionManifest}), so callers pass it directly.
 */
export interface CompositionComponentManifest
  extends Partial<Pick<ComponentManifest, Extract<CompositionManifestKey, "slot">>> {
  readonly props: Readonly<Record<string, CompositionPropDef>>;
  readonly actions?: Readonly<Record<string, CompositionActionDef>>;
}

/** Resolves to `T` only when it is exactly `true`; used to force a compile error on drift. */
type Assert<T extends true> = T;

/**
 * Compile-time guards for the invariant downstream callers rely on: the projected
 * manifest keys still exist on the schema {@link ComponentManifest} (else
 * {@link CompositionManifestKey} loses them), and a real §2 `ComponentManifest`
 * is assignable to {@link CompositionComponentManifest}. Purely type-level (no
 * runtime output); either alias fails to resolve if the corresponding shape drifts.
 */
type _CompositionManifestKeysExist = Assert<
  [CompositionManifestKey] extends ["props" | "actions" | "slot"]
    ? ["props" | "actions" | "slot"] extends [CompositionManifestKey]
      ? true
      : false
    : false
>;
type _ManifestIsCompositionManifest = Assert<
  ComponentManifest extends CompositionComponentManifest ? true : false
>;

/**
 * A component available to a composition: its JSX tag, the identity fields
 * written onto the lowered `component` node, and its manifest (for validating
 * and printing props/actions).
 */
export interface CompositionComponent {
  /** JSX tag used in source (a valid PascalCase identifier). */
  readonly tag: string;
  readonly manifest: CompositionComponentManifest;
  /** `"local"` (in-document `codeComponent`) or `"catalog"` (deployed artifact). */
  readonly source: "local" | "catalog";
  /** `codeComponent` node id when `source` is `"local"`. */
  readonly localComponentId?: string;
  readonly componentSlug: string;
  readonly componentVersion: number;
  readonly contentHash: string;
}

/** The set of components a composition may reference. */
export interface CompositionRegistry {
  readonly components: readonly CompositionComponent[];
}

/** Index a registry by JSX tag (parser lookup: source tag → component). */
export function registryByTag(registry: CompositionRegistry): Map<string, CompositionComponent> {
  const byTag = new Map<string, CompositionComponent>();
  for (const component of registry.components) {
    byTag.set(component.tag, component);
  }
  return byTag;
}

/**
 * Resolve the registry component a `component` AST node refers to (printer
 * lookup). Local instances match by `localComponentId`; catalog instances by
 * `componentSlug`.
 */
export function resolveComponentForNode(
  registry: CompositionRegistry,
  data: {
    readonly componentSource?: string;
    readonly localComponentId?: string;
    readonly componentSlug?: string;
  },
): CompositionComponent | undefined {
  if (data.componentSource === "local") {
    return registry.components.find(
      (component) =>
        component.source === "local" && component.localComponentId === data.localComponentId,
    );
  }
  return registry.components.find(
    (component) => component.source !== "local" && component.componentSlug === data.componentSlug,
  );
}

/**
 * The scalar value discriminator key for a prop kind, or `null` for kinds with
 * no direct scalar representation (`array` uses {@link arrayItemKey}; `component`
 * has no representable binding value).
 */
export function scalarPropValueKey(
  kind: CompositionPropKind,
): "string" | "number" | "boolean" | "product" | null {
  switch (kind) {
    case "string":
    case "select":
    case "image":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "ref":
      return "product";
    default:
      return null;
  }
}

/** The array value discriminator key for an array prop's scalar item kind. */
export function arrayItemKey(
  itemKind: CompositionPropKind | undefined,
): "string-array" | "number-array" | "boolean-array" | null {
  switch (itemKind) {
    case "string":
    case "select":
    case "image":
      return "string-array";
    case "number":
      return "number-array";
    case "boolean":
      return "boolean-array";
    default:
      return null;
  }
}

/**
 * The variable type a prop of the given kind can be bound to via a
 * variable-reference (so `title={someStringVar}` type-checks). Kinds with no
 * bindable variable type (array/component) return `null`.
 */
export function variableTypeForPropKind(
  kind: CompositionPropKind,
): "string" | "number" | "boolean" | "product" | null {
  switch (kind) {
    case "string":
    case "select":
    case "image":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "ref":
      return "product";
    default:
      return null;
  }
}

/** Derive a stable PascalCase JSX tag from a component slug or name. */
export function defaultComponentTag(source: string): string {
  const parts = source.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const pascal = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  if (pascal.length === 0) {
    return "Component";
  }
  return /^[A-Za-z]/.test(pascal) ? pascal : `Component${pascal}`;
}

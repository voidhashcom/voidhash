/**
 * The §2 component manifest — the JSON artifact the CLI extracts from a
 * `defineComponent` definition and uploads alongside the component's runtime
 * bundle. Servers validate uploaded manifests against exactly these shapes.
 */

/** Wire version of the component manifest format. */
export const COMPONENT_MANIFEST_VERSION = 1 as const;

/** Editor kinds a component prop can map to. */
export type ManifestPropKind =
  | "string"
  | "number"
  | "boolean"
  | "select"
  | "image"
  | "ref"
  | "component"
  | "array";

/** Optional UI hint for how a prop should be edited. */
export type ManifestPropEditor = "color";

/** Referenceable runtime entity kinds. `"product"` only in Phase 1. */
export type ManifestRefType = "product";

interface ManifestPropBase {
  readonly label?: string;
  readonly default?: unknown;
  readonly editor?: ManifestPropEditor;
  readonly optional: boolean;
}

export interface ManifestStringProp extends ManifestPropBase {
  readonly kind: "string";
}

export interface ManifestNumberProp extends ManifestPropBase {
  readonly kind: "number";
}

export interface ManifestBooleanProp extends ManifestPropBase {
  readonly kind: "boolean";
}

export interface ManifestSelectProp extends ManifestPropBase {
  readonly kind: "select";
  readonly options: ReadonlyArray<string>;
}

export interface ManifestImageProp extends ManifestPropBase {
  readonly kind: "image";
}

export interface ManifestRefProp extends ManifestPropBase {
  readonly kind: "ref";
  readonly refType: ManifestRefType;
}

export interface ManifestComponentProp extends ManifestPropBase {
  readonly kind: "component";
}

/** Element shape of an array prop. Must be a non-array kind. */
export interface ManifestArrayItem {
  readonly kind: Exclude<ManifestPropKind, "array">;
  readonly options?: ReadonlyArray<string>;
  readonly refType?: ManifestRefType;
  readonly editor?: ManifestPropEditor;
}

export interface ManifestArrayProp extends ManifestPropBase {
  readonly kind: "array";
  readonly item: ManifestArrayItem;
}

export type ManifestProp =
  | ManifestStringProp
  | ManifestNumberProp
  | ManifestBooleanProp
  | ManifestSelectProp
  | ManifestImageProp
  | ManifestRefProp
  | ManifestComponentProp
  | ManifestArrayProp;

/** Scalar kinds allowed in an action payload. */
export type ManifestActionPayloadKind = "string" | "number" | "boolean";

export interface ManifestAction {
  /** Payload field shapes. May be `{}` for payload-less actions. */
  readonly payload: Readonly<
    Record<string, { readonly kind: ManifestActionPayloadKind }>
  >;
}

/** Injected runtime data a component reads. `"products"` only in Phase 1. */
export type ManifestHostData = "products";

export interface ComponentManifest {
  readonly manifestVersion: typeof COMPONENT_MANIFEST_VERSION;
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly props: Readonly<Record<string, ManifestProp>>;
  readonly actions: Readonly<Record<string, ManifestAction>>;
  /** Whether the component renders a `<Slot/>` (exactly one allowed). */
  readonly slot: boolean;
  readonly previewStates: ReadonlyArray<string>;
  readonly hostData: ReadonlyArray<ManifestHostData>;
}

/**
 * The prop schema builder passed to `defineComponent`. It captures both the
 * *type* of each editable prop (for end-to-end type-safety in the component
 * template) and its *editor metadata* (label, default, editor hint, options)
 * which the component manifest (contract §2) and the visual editor consume.
 */
import type { ReactNode } from "react";
import type { PaywallProduct } from "../runtime/config";
import type {
  ManifestPropEditor,
  ManifestPropKind,
  ManifestRefType,
} from "../schema/component-manifest";

/** The kind of a prop, mirroring the §2 manifest vocabulary. */
export type PropKind = ManifestPropKind;

/** Serializable description of a single editable prop. */
export interface PropSchema {
  readonly kind: PropKind;
  readonly label?: string;
  readonly defaultValue?: unknown;
  readonly hasDefault: boolean;
  readonly editor?: ManifestPropEditor;
  readonly optional: boolean;
  readonly options?: ReadonlyArray<string>;
  readonly refType?: ManifestRefType;
  readonly item?: PropSchema;
  readonly localizable?: boolean;
}

/**
 * Immutable, chainable builder for one prop:
 * `p.string().label("Title").default("Untitled")`.
 *
 * Type parameters (all phantom, never read at runtime):
 * - `T` — the prop's runtime value type, threaded through {@link InferProps}.
 * - `Opt` — whether `.optional()` was applied.
 * - `Def` — whether `.default()` was applied.
 * - `K` — the prop kind, used to forbid nested arrays at the type level.
 */
export class PropBuilder<
  T,
  Opt extends boolean = false,
  Def extends boolean = false,
  K extends PropKind = PropKind,
> {
  declare readonly __value: T;
  declare readonly __optional: Opt;
  declare readonly __hasDefault: Def;
  readonly schema: PropSchema & { readonly kind: K };

  constructor(schema: PropSchema & { readonly kind: K }) {
    this.schema = schema;
  }

  /** Sets the human-readable label shown in the editor. */
  label(label: string): PropBuilder<T, Opt, Def, K> {
    return new PropBuilder({ ...this.schema, label });
  }

  /**
   * Sets the default value applied when the consumer omits this prop. A prop
   * with a default is optional for consumers but always present in the
   * template.
   */
  default(value: T): PropBuilder<T, Opt, true, K> {
    return new PropBuilder({
      ...this.schema,
      defaultValue: value,
      hasDefault: true,
    });
  }

  /**
   * Attaches an editor UI hint (`"color"` renders a colour picker). Only
   * string props accept an editor hint (contract §2) — the `this` constraint
   * makes the method uncallable on any other prop kind.
   */
  editor(
    this: PropBuilder<T, Opt, Def, "string">,
    editor: ManifestPropEditor,
  ): PropBuilder<T, Opt, Def, "string"> {
    return new PropBuilder({ ...this.schema, editor });
  }

  /**
   * Marks the prop as translatable per locale. Only `"string"` and `"image"`
   * props carry localizable content (contract §2) — the `this` constraint makes
   * the method uncallable on any other prop kind. The returned builder keeps the
   * receiver's concrete kind so later kind-specific chaining (e.g. string-only
   * `.editor()`) still works.
   */
  localizable(
    this: PropBuilder<T, Opt, Def, "string" | "image">,
  ): PropBuilder<T, Opt, Def, K> {
    // The returned builder preserves the receiver's concrete kind `K`, which the
    // `this` constraint widens to the localizable union; the cast re-narrows it.
    return new PropBuilder({ ...this.schema, localizable: true }) as PropBuilder<T, Opt, Def, K>;
  }

  /** Marks the prop as omittable; the template receives `T | undefined`. */
  optional(): PropBuilder<T, true, Def, K> {
    return new PropBuilder({ ...this.schema, optional: true });
  }
}

/** Any prop builder, used as the constraint for prop maps. */
export type AnyPropBuilder = PropBuilder<unknown, boolean, boolean, PropKind>;

/** A record of prop builders, as returned by a `props` callback. */
export type PropMap = Record<string, AnyPropBuilder>;

const base = (kind: PropKind): PropSchema & { kind: PropKind } => ({
  kind,
  hasDefault: false,
  optional: false,
});

/** The `p` builder factory handed to a `defineComponent({ props })` callback. */
export interface PropFactory {
  string(): PropBuilder<string, false, false, "string">;
  number(): PropBuilder<number, false, false, "number">;
  boolean(): PropBuilder<boolean, false, false, "boolean">;
  /** A constrained string value chosen from `options`. */
  select<const O extends ReadonlyArray<string>>(
    options: O,
  ): PropBuilder<O[number], false, false, "select">;
  /** An image URL/asset reference. */
  image(): PropBuilder<string, false, false, "image">;
  /** A reference to a runtime entity. The template receives the entity value. */
  ref(refType: "product"): PropBuilder<PaywallProduct, false, false, "ref">;
  /** A nested element the editor can fill. The template receives a ReactNode. */
  component(): PropBuilder<ReactNode, false, false, "component">;
  /** A homogeneous list. The item must be a non-array kind. */
  array<B extends PropBuilder<unknown, boolean, boolean, Exclude<PropKind, "array">>>(
    item: B,
  ): PropBuilder<Array<B["__value"]>, false, false, "array">;
}

export const propFactory: PropFactory = {
  string: () =>
    new PropBuilder<string, false, false, "string">({
      ...base("string"),
      kind: "string",
    }),
  number: () =>
    new PropBuilder<number, false, false, "number">({
      ...base("number"),
      kind: "number",
    }),
  boolean: () =>
    new PropBuilder<boolean, false, false, "boolean">({
      ...base("boolean"),
      kind: "boolean",
    }),
  select: <const O extends ReadonlyArray<string>>(options: O) =>
    new PropBuilder<O[number], false, false, "select">({
      ...base("select"),
      kind: "select",
      options: [...options],
    }),
  image: () =>
    new PropBuilder<string, false, false, "image">({
      ...base("image"),
      kind: "image",
    }),
  ref: (refType) =>
    new PropBuilder<PaywallProduct, false, false, "ref">({
      ...base("ref"),
      kind: "ref",
      refType,
    }),
  component: () =>
    new PropBuilder<ReactNode, false, false, "component">({
      ...base("component"),
      kind: "component",
    }),
  array: <B extends PropBuilder<unknown, boolean, boolean, Exclude<PropKind, "array">>>(
    item: B,
  ) => {
    // Type-level enforced; runtime guard covers untyped (plain JS) authors.
    if (String(item.schema.kind) === "array") {
      throw new Error("array() items must be a non-array prop kind.");
    }
    return new PropBuilder<Array<B["__value"]>, false, false, "array">({
      ...base("array"),
      kind: "array",
      item: item.schema,
    });
  },
};

/** The runtime value type of a prop builder. */
export type PropValueOf<B> = B extends PropBuilder<infer T, boolean, boolean, PropKind> ? T : never;

/**
 * The props object a component template receives: defaults are always filled
 * in, `.optional()` props may be `undefined`.
 */
export type InferProps<M extends PropMap> = {
  [K in keyof M]: M[K] extends PropBuilder<infer T, infer O, infer D, PropKind>
    ? D extends true
      ? T
      : O extends true
        ? T | undefined
        : T
    : never;
};

type OptionalPropKeys<M extends PropMap> = {
  [K in keyof M]: M[K] extends PropBuilder<unknown, infer O, infer D, PropKind>
    ? O extends true
      ? K
      : D extends true
        ? K
        : never
    : never;
}[keyof M];

/**
 * The props a *consumer* of the component passes: `.optional()` and
 * `.default()` props may be omitted, everything else is required.
 */
export type InferExternalProps<M extends PropMap> = {
  [K in Exclude<keyof M, OptionalPropKeys<M>>]: PropValueOf<M[K]>;
} & {
  [K in OptionalPropKeys<M>]?: PropValueOf<M[K]>;
};

/**
 * Applies declared defaults to incoming consumer props, returning the
 * fully-populated props object the template receives.
 */
export const applyPropDefaults = <M extends PropMap>(
  propMap: M,
  incoming: Record<string, unknown>,
): InferProps<M> => {
  const result: Record<string, unknown> = {};
  for (const [key, builder] of Object.entries(propMap)) {
    const provided = incoming[key];
    if (provided !== undefined) {
      result[key] = provided;
    } else if (builder.schema.hasDefault) {
      result[key] = builder.schema.defaultValue;
    }
  }
  // Safe: the loop fills exactly the keys of `M` with provided-or-default
  // values, which is what `InferProps<M>` describes.
  return result as InferProps<M>;
};

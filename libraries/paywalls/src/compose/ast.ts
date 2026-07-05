/**
 * The public, serializable composition AST — the seam between the OSS authoring
 * half (parser/printer) and the closed mimic bridge (lowerer/lifter).
 *
 * `parseComposition` produces a `CompositionAST` from source; the closed
 * `lowerAst` turns it into a `PaywallDesignerDocumentInput`. Conversely the
 * closed `liftSnapshot` produces a `CompositionAST` from a decoded mimic
 * snapshot and `printComposition` serializes it back to source.
 *
 * The AST carries exactly the information the grammar expresses — node
 * structure, styles, interactions, variables, component props/action bindings —
 * as plain data (no mimic envelopes, no react). Element nodes carry an optional
 * inline `id`: the printer emits it (first attribute) when present and the
 * parser reads it back, so a mimic node's identity survives a code round-trip.
 * `id` is absent for hand-authored, id-free source (the lowerer mints one). Node
 * positions are NOT part of the AST.
 */

/** Declared variable type. */
export type CompositionVariableType = "string" | "number" | "boolean" | "product";

/** A paywall-scoped variable declaration. */
export interface CompositionVariable {
  readonly name: string;
  readonly type: CompositionVariableType;
  /** The declared default value. Absent ⇒ the type's zero value. */
  readonly defaultValue?: string | number | boolean;
}

/**
 * A JSON-ish structured style value: a plain object or array whose leaves are
 * scalars (or further nested objects/arrays). Structured style fields like
 * `backgroundGradient` / `backgroundImage` carry these; scalar fields do not.
 */
export type CompositionStyleObject =
  | { readonly [key: string]: CompositionStyleValue }
  | readonly CompositionStyleValue[];

/**
 * A style value: a literal string / number / boolean, or a JSON-ish structured
 * object/array (for structured background fields). Structured values are plain
 * JSON — no identifiers, spreads, or computed keys.
 */
export type CompositionStyleValue = string | number | boolean | CompositionStyleObject;

/** A product source used by an action. */
export type CompositionProductSource =
  | { readonly kind: "literal"; readonly productId: string }
  | { readonly kind: "variable"; readonly variableName: string }
  /** `payload("field")` — only valid inside a component action binding. */
  | { readonly kind: "payload"; readonly field: string };

/** A scalar value carried by a set-variable action. */
export type CompositionScalarSource =
  | { readonly kind: "literal-string"; readonly value: string }
  | { readonly kind: "literal-number"; readonly value: number }
  | { readonly kind: "literal-boolean"; readonly value: boolean }
  | { readonly kind: "literal-product"; readonly productId: string }
  | { readonly kind: "variable"; readonly variableName: string }
  | { readonly kind: "payload"; readonly field: string };

/** An action bound to an interaction or a component action slot. */
export type CompositionAction =
  | { readonly kind: "close-paywall" }
  | { readonly kind: "none" }
  | { readonly kind: "purchase"; readonly product: CompositionProductSource }
  | {
      readonly kind: "set-variable";
      readonly variableName: string;
      readonly value: CompositionScalarSource;
    };

/** A value bound to a component prop: a literal or a variable reference. */
export type CompositionPropValue =
  | { readonly kind: "literal-string"; readonly value: string }
  | { readonly kind: "literal-number"; readonly value: number }
  | { readonly kind: "literal-boolean"; readonly value: boolean }
  | { readonly kind: "literal-product"; readonly productId: string }
  | { readonly kind: "literal-string-array"; readonly value: readonly string[] }
  | { readonly kind: "literal-number-array"; readonly value: readonly number[] }
  | { readonly kind: "literal-boolean-array"; readonly value: readonly boolean[] }
  | { readonly kind: "variable"; readonly variableName: string };

/** A component prop binding (prop name → value). */
export interface CompositionPropBinding {
  readonly name: string;
  readonly value: CompositionPropValue;
}

/** A component action binding (action name → action). */
export interface CompositionActionBinding {
  readonly name: string;
  readonly action: CompositionAction;
}

/** A node interaction (trigger → action). Only `click` (onPress) today. */
export interface CompositionInteraction {
  readonly trigger: "click";
  readonly action: CompositionAction;
}

/** A layout element: `<Screen>` / `<View>` / `<Text>`. */
export interface CompositionElementNode {
  readonly kind: "element";
  readonly type: "screen" | "view" | "text";
  /**
   * The mimic node id, carried inline as the reserved `id` attribute. Present
   * when lifted from (or authored against) a real document; absent for id-free
   * hand-authored source, in which case the lowerer mints a fresh id.
   */
  readonly id?: string;
  /** Node display name (`name=` attribute), or absent (⇒ default). */
  readonly name?: string;
  /** Style field name → value. Field names are the exact mimic style fields. */
  readonly style: Readonly<Record<string, CompositionStyleValue>>;
  readonly interactions: readonly CompositionInteraction[];
  /** `text` nodes carry text content; layout nodes carry children. */
  readonly text?: string;
  readonly children: readonly CompositionNode[];
}

/** A code-component instance: `<SomeComponent …>`. */
export interface CompositionComponentNode {
  readonly kind: "component";
  /** The registry tag this instance referenced (printer/lowerer identity). */
  readonly tag: string;
  /**
   * The mimic node id, carried inline as the reserved `id` attribute (same
   * semantics as {@link CompositionElementNode.id}).
   */
  readonly id?: string;
  /** Node display name (`name=` attribute), or absent (⇒ default). */
  readonly name?: string;
  readonly props: readonly CompositionPropBinding[];
  readonly actionBindings: readonly CompositionActionBinding[];
  readonly children: readonly CompositionNode[];
}

export type CompositionNode = CompositionElementNode | CompositionComponentNode;

/** A parsed composition: its root screen and paywall-level variable declarations. */
export interface CompositionAST {
  readonly variables: readonly CompositionVariable[];
  readonly root: CompositionElementNode;
}

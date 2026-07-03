/**
 * Authoring surface for `.paywall.tsx` composition files
 * (`import { … } from "@voidhash/paywalls/compose"`).
 *
 * These declarations exist for editor tooling and type-checking only. The
 * composition parser never *executes* a paywall file — it parses the source and
 * lowers the closed grammar into a {@link CompositionAST}. The runtime bodies
 * here are intentionally inert.
 *
 * The `Screen`/`View`/`Text` tags carry PRECISE per-node prop types
 * ({@link ScreenProps}/{@link ViewProps}/{@link TextProps}), derived from the
 * shared style registry, so an unknown attribute or a wrong-typed value errors
 * at type-check time rather than only at parse/encode time. The type-only import
 * from `./style-attr-types` erases, so this module stays runtime-inert and the
 * compose graph stays react/mimic-free.
 *
 * NOTE: this covers the current Phase 1 subset (Screen/View/Text, styles,
 * variables, node interactions, and component props/actions). States and
 * Shape/Path are a documented next increment.
 */
import type { ScreenProps, TextProps, ViewProps } from "./style-attr-types";

export interface VariableHandle<T> {
  /** Marks this identifier as a variable reference; not called at runtime. */
  readonly __type: T;
  /** Build a set-variable action bound to this variable. */
  set(value: T): Action;
}

export interface ProductRef {
  readonly __product: true;
}

export interface Action {
  readonly __action: true;
}

type Node = unknown;

/** Declare the paywall composition. Its callback is analyzed, never run. */
export declare function paywall(build: () => Node): Node;

export declare const Screen: (props: ScreenProps) => Node;
export declare const View: (props: ViewProps) => Node;
export declare const Text: (props: TextProps) => Node;

export declare const variable: {
  string(name: string, opts?: { default?: string }): VariableHandle<string>;
  number(name: string, opts?: { default?: number }): VariableHandle<number>;
  boolean(name: string, opts?: { default?: boolean }): VariableHandle<boolean>;
  product(name: string): VariableHandle<ProductRef>;
};

/** Reference a catalog product by id. */
export declare function product(id: string): ProductRef;

/** Built-in actions for node interactions. */
export declare function purchase(product: ProductRef | VariableHandle<ProductRef>): Action;
export declare function closePaywall(): Action;

/** An explicit no-op action binding for a component action (does nothing). */
export declare function none(): Action;

/**
 * Read a field of the payload emitted by a component action, for use inside that
 * action's binding — e.g. `onSelect={selected.set(payload("product"))}`. Only
 * valid within a component action binding; the field must be declared by the
 * component's action.
 */
export declare function payload(field: string): any;

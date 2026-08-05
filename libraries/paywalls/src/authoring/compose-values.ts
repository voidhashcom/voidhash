/**
 * The inert author-surface markers, exported from the package ROOT
 * (`@voidhash/paywalls`).
 *
 * Code-component source imports these symbols so it type-checks and a real
 * tsc/bundler pass succeeds. The runtime bodies are intentionally inert:
 * `variable.*`/`product`/`purchase`/… return opaque marker objects whose only
 * job is to exist and carry an action binding. Their TYPES
 * ({@link VariableHandle}/{@link ProductRef}/{@link Action}) carry the precise
 * author-surface shapes so completions and diagnostics work in Monaco and real
 * tsc.
 */

/**
 * A paywall-scoped variable reference, produced by `variable.<type>(name)`. At
 * runtime the handle is an inert marker (never dereferenced); its `.set(value)`
 * builds a set-variable action.
 */
export interface VariableHandle<T> {
  /** Marks this identifier as a variable reference; not read at runtime. */
  readonly __type: T;
  /** Build a set-variable action bound to this variable. */
  set(value: T): Action;
}

/** A catalog product reference, produced by `product(id)`. Inert marker. */
export interface ProductRef {
  readonly __product: true;
}

/** A bound node/component interaction, produced by the action helpers. Inert marker. */
export interface Action {
  readonly __action: true;
}

/** The shared inert action marker returned by every action helper. */
const ACTION_MARKER: Action = { __action: true };

/** Build an inert {@link VariableHandle} marker for a declared variable. */
const makeVariableHandle = <T>(): VariableHandle<T> => ({
  __type: undefined as T,
  set: () => ACTION_MARKER,
});

/**
 * Declares a paywall-scoped variable. The parser recognizes the `variable.*(…)`
 * call and its declared default; the returned handle is inert.
 */
export const variable: {
  string(name: string, opts?: { default?: string }): VariableHandle<string>;
  number(name: string, opts?: { default?: number }): VariableHandle<number>;
  boolean(name: string, opts?: { default?: boolean }): VariableHandle<boolean>;
  product(name: string): VariableHandle<ProductRef>;
} = {
  string: () => makeVariableHandle<string>(),
  number: () => makeVariableHandle<number>(),
  boolean: () => makeVariableHandle<boolean>(),
  product: () => makeVariableHandle<ProductRef>(),
};

/** References a catalog product by id. Inert marker. */
export const product = (_id: string): ProductRef => ({ __product: true });

/** A purchase action for a product (or product variable). Inert marker. */
export const purchase = (_product: ProductRef | VariableHandle<ProductRef>): Action => ACTION_MARKER;

/** A close-paywall action. Inert marker. */
export const closePaywall = (): Action => ACTION_MARKER;

/** An explicit no-op action binding (does nothing). Inert marker. */
export const none = (): Action => ACTION_MARKER;

/**
 * Reads a field of the payload emitted by a component action, for use inside
 * that action's binding — e.g. `onSelect={selected.set(payload("product"))}`.
 * Only valid within a component action binding; the field must be declared by
 * the component's action. Inert marker (typed `any` so it slots into any
 * expected value position).
 */
// payload slots into any action value position.
export const payload = (_field: string): any => undefined;

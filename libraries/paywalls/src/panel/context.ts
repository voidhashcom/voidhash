/**
 * The `PanelContext` an editor-panel definition receives — the author-facing
 * read/write surface over the component's currently-selected props, the
 * selection, and the injected host data.
 *
 * A panel definition is a pure function `(ctx) => ReactNode`: it reads
 * `ctx.props.<name>.value` to render controls and calls `ctx.props.<name>.set`
 * / `.reset` / `.cancel` from event handlers. Those calls never mutate host
 * state directly — they emit serializable {@link PanelIntent}s the host
 * reduces. The context is rebuilt from a fresh {@link PanelSessionInputs}
 * snapshot on every host update, so `value`/`mixed`/`bound` always reflect the
 * host's current truth.
 */
import type { PaywallProduct, PaywallVariables } from "../runtime/config";
import type { PropKind } from "../authoring/props";

/** How a `set` write should be treated by the host's undo/gesture model. */
export type PanelGesture = "live" | "commit";

/** Options accepted by a {@link PanelPropHandle} `set`. */
export interface PanelSetOptions {
  /**
   * `"live"` — a transient value during a drag (no undo entry); `"commit"` —
   * the final value on release (pushes one undo entry). Defaults to
   * `"commit"`.
   */
  readonly gesture?: PanelGesture;
}

/**
 * The read/write handle for a single declared prop. `value` is the host's
 * current value (resolved to the bound variable's value when `bound`), `mixed`
 * is true across a multi-selection with differing values, and `bound` is true
 * when the prop is driven by a variable (host owns bind/unbind chrome; guest
 * `set` on a bound prop is dropped).
 */
export interface PanelPropHandle<T = unknown> {
  readonly value: T | undefined;
  readonly mixed: boolean;
  readonly bound: boolean;
  /** The declared prop kind, so a panel can branch on it without host data. */
  readonly kind: PropKind;
  /** Writes a new value, emitting a `set-prop` intent (dropped when `bound`). */
  set(value: T, options?: PanelSetOptions): void;
  /** Discards an in-flight live gesture, emitting a `gesture-discard` intent. */
  cancel(): void;
  /** Resets the prop to its default, emitting a `reset-prop` intent. */
  reset(): void;
}

/**
 * The handle for a `p.ref("product")` prop: the host-resolved product value,
 * its id, and a `set(productId)` that rebinds the reference.
 */
export interface PanelRefPropHandle {
  readonly value: PaywallProduct | undefined;
  readonly productId: string | undefined;
  readonly mixed: boolean;
  readonly kind: "ref";
  set(productId: string): void;
}

/**
 * A read-only handle for props the host owns entirely (component/slot props):
 * the panel may read the value but cannot write it.
 */
export interface PanelReadonlyPropHandle<T = unknown> {
  readonly value: T | undefined;
  readonly mixed: boolean;
  readonly kind: PropKind;
}

/** The current selection the panel edits. */
export interface PanelSelection {
  /** How many instances are selected (1 = single, >1 = multi/mixed). */
  readonly count: number;
}

/** Injected, serializable host data a panel reads (products, variables). */
export interface PanelData {
  readonly products: ReadonlyArray<PaywallProduct>;
  readonly variables: PaywallVariables;
}

/**
 * The default, loosely-typed `ctx.props` bag: one handle per declared prop.
 * `defineComponent` refines this against the component's prop map (see
 * {@link ../panel/index}). A ref prop resolves to {@link PanelRefPropHandle}, a
 * component prop to a read-only handle, everything else to a writable
 * {@link PanelPropHandle}.
 */
export type PanelProps = Record<
  string,
  PanelPropHandle | PanelRefPropHandle | PanelReadonlyPropHandle
>;

/**
 * The context object a panel definition receives. `props` is refined per the
 * component's manifest by `defineComponent`; `selection` and `data` are
 * host-filled.
 */
export interface PanelContext<P extends PanelProps = PanelProps> {
  readonly props: P;
  readonly selection: PanelSelection;
  readonly data: PanelData;
}

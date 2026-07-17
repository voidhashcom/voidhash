import { type ReactNode, useMemo, useRef } from "react";

import type {
  PanelContext,
  PanelProps,
  PanelPropHandle,
  PanelReadonlyPropHandle,
  PanelRefPropHandle,
} from "../panel/context";
import { SlotProvider } from "../primitives/slot";
import type {
  PaywallDimensionsByTarget,
  PaywallPlatform,
  PaywallProduct,
  PaywallSafeAreaInsets,
  PaywallVariables,
} from "../runtime/config";
import {
  type ActionFactory,
  type ActionHandlerProps,
  type ActionMap,
  actionFactory,
  buildActionCallbacks,
  type InferActions,
} from "./actions";
import type { Action, VariableHandle } from "./compose-values";
import {
  applyPropDefaults,
  type InferExternalProps,
  type InferProps,
  type PropBuilder,
  type PropFactory,
  type PropMap,
  propFactory,
  type PropValueOf,
} from "./props";

/** Fixtures one preview state renders against (contract §2 `previewStates`). */
export interface ComponentPreviewState<M extends PropMap> {
  /** Prop values for this state. Unset props fall back to their defaults. */
  readonly props?: Partial<InferExternalProps<M>>;
  /** Injected runtime data the preview renders with. */
  readonly data?: {
    readonly products?: ReadonlyArray<PaywallProduct>;
    readonly variables?: PaywallVariables;
    readonly platform?: PaywallPlatform;
    readonly safeAreaInsets?: PaywallSafeAreaInsets;
    readonly dimensions?: PaywallDimensionsByTarget;
  };
}

/** The context object a component template receives. */
export interface ComponentRenderContext<M extends PropMap, A extends ActionMap> {
  readonly props: InferProps<M>;
  readonly actions: InferActions<A>;
}

/**
 * The props a consumer of the component passes: declared props (optional when
 * `.optional()`/`.default()`), one optional handler per declared action, and
 * children (surfaced at the template's `<Slot />`).
 */
export type InferComponentProps<M extends PropMap, A extends ActionMap> = InferExternalProps<M> &
  ActionHandlerProps<A> & { children?: ReactNode };

/** The renderable React component produced by {@link defineComponent}. */
export type PaywallComponent<M extends PropMap, A extends ActionMap> = (
  props: InferComponentProps<M, A>,
) => ReactNode;

/** Identity metadata attached to every component definition. */
export interface PaywallComponentMeta {
  readonly kind: "component";
  readonly title?: string;
  readonly description?: string;
}

/**
 * The refined `ctx.props` handle for one declared prop, chosen by its kind: a
 * `ref` prop becomes a {@link PanelRefPropHandle}, a `component` prop a
 * read-only handle, everything else a writable {@link PanelPropHandle} typed to
 * the prop's value.
 */
type PanelPropHandleFor<B> = B extends PropBuilder<infer T, boolean, boolean, infer K>
  ? K extends "ref"
    ? PanelRefPropHandle
    : K extends "component"
      ? PanelReadonlyPropHandle<T>
      : PanelPropHandle<T>
  : never;

/** The `ctx.props` bag for a panel, refined against the component's prop map. */
export type PanelPropsFor<M extends PropMap> = {
  readonly [K in keyof M]: PanelPropHandleFor<M[K]>;
} & PanelProps;

/**
 * A component's custom editor panel: a function of a {@link PanelContext}
 * refined against the component's declared props. Compose it from the `Panel.*`
 * primitives (`@voidhash/paywalls/panel`); the reconciler serializes the
 * returned element into a data-only {@link PanelTree}.
 */
export type ComponentPanel<M extends PropMap> = (ctx: PanelContext<PanelPropsFor<M>>) => ReactNode;

/**
 * The widened prop surface for a component instance placed in a paywall
 * document. Each declared prop accepts its literal value OR a matching
 * {@link VariableHandle}; each declared action accepts a real handler OR an
 * {@link Action} marker (e.g. `purchase(…)`); plus the reserved `id`/`name` node
 * attributes and, when the component renders a `<Slot/>`, `children`.
 *
 * This is intentionally wider than {@link InferComponentProps} (the runtime
 * consumer surface) so that a component instance whose `title` binds to a
 * variable and `onSelect` binds to `purchase(p)` type-checks. Slotting is not
 * knowable from the types alone, so `children` is always permitted here.
 */
export type ComposeComponentProps<M extends PropMap, A extends ActionMap> = {
  [K in keyof M]?: PropValueOf<M[K]> | VariableHandle<PropValueOf<M[K]>>;
} & {
  [K in keyof A]?: (ActionHandlerProps<A>[K] extends infer H ? H : never) | Action;
} & {
  readonly id?: string;
  readonly name?: string;
  readonly children?: ReactNode;
};

export interface DefineComponentInput<M extends PropMap, A extends ActionMap> {
  /** Display name shown in the editor / catalog. */
  readonly title?: string;
  readonly description?: string;
  /** Declares the component's editable props using the `p` builder factory. */
  readonly props?: (p: PropFactory) => M;
  /** Declares the component's actions using the `a` builder factory. */
  readonly actions?: (a: ActionFactory) => A;
  /** Named preview states the CLI renders to §3 node trees at build time. */
  readonly previews?: Readonly<Record<string, ComponentPreviewState<M>>>;
  /**
   * Custom editor panel: `(ctx) => ReactNode` built from the `Panel.*`
   * primitives. Runs in a {@link createPanelSession}; omit it for the default
   * host-generated panel.
   */
  readonly panel?: ComponentPanel<M>;
  /** The component template. Receives fully-typed props and action callbacks. */
  readonly render: (ctx: ComponentRenderContext<M, A>) => ReactNode;
}

/** The metadata fields attached to a component definition (everything but the call signature). */
export interface ComponentDefinitionFields<M extends PropMap, A extends ActionMap> {
  readonly title?: string;
  readonly description?: string;
  /** The resolved prop builders, keyed by name. */
  readonly props: M;
  /** The resolved action builders, keyed by name. */
  readonly actions: A;
  readonly previews: Readonly<Record<string, ComponentPreviewState<M>>>;
  readonly panel?: ComponentPanel<M>;
  /** The original template function (used for declarative slot detection). */
  readonly render: (ctx: ComponentRenderContext<M, A>) => ReactNode;
  /**
   * The renderable React component. Alias of the definition's own call
   * signature — kept because the sandbox/render pipelines reference `.component`
   * explicitly. Prefer calling the definition directly (`<X/>`) in composition
   * code.
   */
  readonly component: PaywallComponent<M, A>;
  readonly __voidhash: PaywallComponentMeta;
}

/**
 * A reusable paywall component definition: a CALLABLE React component (so
 * `import X from "./components/x"; <X/>` works as a real module and typechecks
 * against the widened prop surface) carrying all the metadata needed to extract
 * the §2 manifest and render §3 preview trees.
 *
 * The call signature accepts {@link ComposeComponentProps} (widened to accept
 * variable/action bindings); {@link renderComponentToTree} and other runtime
 * consumers invoke `.component` (the same function) with resolved runtime props.
 */
export type ComponentDefinition<M extends PropMap, A extends ActionMap> = ((
  props: ComposeComponentProps<M, A>,
) => ReactNode) &
  ComponentDefinitionFields<M, A>;

/**
 * Defines a reusable, code-driven paywall component.
 *
 * A component file default-exports the definition. The component is stored as
 * real source in a `codeComponent` node of the paywall document, compiled
 * in-browser (esbuild-wasm) and referenced from component instances by node id.
 *
 * ```tsx
 * export default defineComponent({
 *   props: (p) => ({
 *     product: p.ref("product"),
 *     accentColor: p.string().editor("color").default("#16a34a"),
 *   }),
 *   actions: (a) => ({ onSelect: a.action({ productId: a.string() }) }),
 *   render: ({ props, actions }) => (
 *     <Pressable onPress={() => actions.onSelect({ productId: props.product.id })}>
 *       <Text>{props.product.displayName}</Text>
 *       <Slot />
 *     </Pressable>
 *   ),
 * });
 * ```
 */
export const defineComponent = <
  M extends PropMap = Record<never, never>,
  A extends ActionMap = Record<never, never>,
>(
  input: DefineComponentInput<M, A>,
): ComponentDefinition<M, A> => {
  // Safe: when `props`/`actions` are omitted the maps are empty, which is
  // exactly what the `Record<never, never>` defaults describe.
  const propMap = (input.props?.(propFactory) ?? {}) as M;
  const actionMap = (input.actions?.(actionFactory) ?? {}) as A;
  const render = input.render;

  const Component = (incoming: InferComponentProps<M, A>): ReactNode => {
    const { children, ...rest } = incoming;
    const handlersRef = useRef<Record<string, unknown>>(rest);
    // Keep the latest handlers readable from the stable action callbacks.
    handlersRef.current = rest;
    const actions = useMemo(() => buildActionCallbacks(actionMap, () => handlersRef.current), []);
    const props = applyPropDefaults(propMap, rest);
    return <SlotProvider value={children ?? null}>{render({ actions, props })}</SlotProvider>;
  };
  Component.displayName = input.title ?? "Component";

  // The definition IS the React component (so `import X from "./x"; <X/>` works
  // as a real module) with all metadata assigned onto the same function. The
  // runtime component's typed prop surface differs from the widened call
  // signature `ComponentDefinition` advertises, so the assembled object is cast
  // to the definition type — both surfaces are backed by this one function.
  const fields: ComponentDefinitionFields<M, A> = {
    __voidhash: {
      kind: "component",
      title: input.title,
      description: input.description,
    },
    actions: actionMap,
    component: Component,
    description: input.description,
    panel: input.panel,
    previews: input.previews ?? {},
    props: propMap,
    render,
    title: input.title,
  };
  return Object.assign(Component, fields) as unknown as ComponentDefinition<M, A>;
};

/**
 * Type guard for a {@link ComponentDefinition}. A definition is now a callable
 * function carrying `__voidhash.kind === "component"` and a `render` template.
 */
export const isComponentDefinition = (
  value: unknown,
): value is ComponentDefinition<PropMap, ActionMap> =>
  typeof value === "function" &&
  (value as { __voidhash?: PaywallComponentMeta }).__voidhash?.kind === "component" &&
  typeof (value as { render?: unknown }).render === "function" &&
  typeof (value as { component?: unknown }).component === "function";

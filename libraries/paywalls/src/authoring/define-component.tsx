import { type ReactNode, useMemo, useRef } from "react";

import { SlotProvider } from "../primitives/slot";
import type { PaywallProduct, PaywallVariables } from "../runtime/config";
import {
  type ActionFactory,
  type ActionHandlerProps,
  type ActionMap,
  actionFactory,
  buildActionCallbacks,
  type InferActions,
} from "./actions";
import {
  applyPropDefaults,
  type InferExternalProps,
  type InferProps,
  type PropFactory,
  type PropMap,
  propFactory,
} from "./props";

/** Fixtures one preview state renders against (contract §2 `previewStates`). */
export interface ComponentPreviewState<M extends PropMap> {
  /** Prop values for this state. Unset props fall back to their defaults. */
  readonly props?: Partial<InferExternalProps<M>>;
  /** Injected runtime data the preview renders with. */
  readonly data?: {
    readonly products?: ReadonlyArray<PaywallProduct>;
    readonly variables?: PaywallVariables;
  };
}

/** The context object a component template receives. */
export interface ComponentRenderContext<
  M extends PropMap,
  A extends ActionMap,
> {
  readonly props: InferProps<M>;
  readonly actions: InferActions<A>;
}

/**
 * The props a consumer of the component passes: declared props (optional when
 * `.optional()`/`.default()`), one optional handler per declared action, and
 * children (surfaced at the template's `<Slot />`).
 */
export type InferComponentProps<
  M extends PropMap,
  A extends ActionMap,
> = InferExternalProps<M> & ActionHandlerProps<A> & { children?: ReactNode };

/** The renderable React component produced by {@link defineComponent}. */
export type PaywallComponent<M extends PropMap, A extends ActionMap> = (
  props: InferComponentProps<M, A>,
) => ReactNode;

/** Identity metadata attached to every component definition. */
export interface PaywallComponentMeta {
  readonly kind: "component";
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
}

export interface DefineComponentInput<M extends PropMap, A extends ActionMap> {
  /** Stable component slug (`^[a-z0-9][a-z0-9-]{0,63}$`), e.g. "product-option". */
  readonly id: string;
  /** Display name shown in the editor. */
  readonly title?: string;
  readonly description?: string;
  /** Declares the component's editable props using the `p` builder factory. */
  readonly props?: (p: PropFactory) => M;
  /** Declares the component's actions using the `a` builder factory. */
  readonly actions?: (a: ActionFactory) => A;
  /** Named preview states the CLI renders to §3 node trees at build time. */
  readonly previews?: Readonly<Record<string, ComponentPreviewState<M>>>;
  /**
   * Custom editor panel (data-only `@voidhash/paywalls/panel` elements).
   * Accepted but inert in Phase 1.
   */
  readonly panel?: ReactNode;
  /** The component template. Receives fully-typed props and action callbacks. */
  readonly render: (ctx: ComponentRenderContext<M, A>) => ReactNode;
}

/**
 * A reusable paywall component definition: the renderable React component plus
 * everything the CLI needs to emit the §2 manifest and §3 preview trees.
 */
export interface ComponentDefinition<M extends PropMap, A extends ActionMap> {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  /** The resolved prop builders, keyed by name. */
  readonly props: M;
  /** The resolved action builders, keyed by name. */
  readonly actions: A;
  readonly previews: Readonly<Record<string, ComponentPreviewState<M>>>;
  readonly panel?: ReactNode;
  /** The original template function (used for declarative slot detection). */
  readonly render: (ctx: ComponentRenderContext<M, A>) => ReactNode;
  /** The renderable React component. */
  readonly component: PaywallComponent<M, A>;
  readonly __voidhash: PaywallComponentMeta;
}

/**
 * Defines a reusable, code-driven paywall component.
 *
 * ```tsx
 * export const definition = defineComponent({
 *   id: "product-option",
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
 * export const ProductOption = definition.component;
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
    const actions = useMemo(
      () => buildActionCallbacks(actionMap, () => handlersRef.current),
      [],
    );
    const props = applyPropDefaults(propMap, rest);
    return (
      <SlotProvider value={children ?? null}>
        {render({ actions, props })}
      </SlotProvider>
    );
  };
  Component.displayName = input.title ?? input.id;

  return {
    __voidhash: {
      kind: "component",
      id: input.id,
      title: input.title,
      description: input.description,
    },
    actions: actionMap,
    component: Component,
    description: input.description,
    id: input.id,
    panel: input.panel,
    previews: input.previews ?? {},
    props: propMap,
    render,
    title: input.title,
  };
};

/** Type guard for a {@link ComponentDefinition}. */
export const isComponentDefinition = (
  value: unknown,
): value is ComponentDefinition<PropMap, ActionMap> =>
  typeof value === "object" &&
  value !== null &&
  (value as { __voidhash?: PaywallComponentMeta }).__voidhash?.kind ===
    "component" &&
  typeof (value as { render?: unknown }).render === "function" &&
  typeof (value as { component?: unknown }).component === "function";

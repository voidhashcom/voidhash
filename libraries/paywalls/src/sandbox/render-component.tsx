/**
 * Component-level bridge between a {@link ComponentDefinition} and the §3
 * preview node tree, built on the real react-reconciler `renderToNodeTree`.
 *
 * The studio sandbox calls {@link renderComponentToTree} once per preview
 * state. Unlike a raw `renderToNodeTree(element)` call it also: resolves the
 * definition's declared prop defaults, mocks `p.ref("product")` props from the
 * supplied host data, maps the sandbox {@link SandboxHostData} fixture into a
 * runtime config (so `usePaywallProducts` etc. resolve), and enforces the
 * "at most one `<Slot/>`" contract by collapsing violations to a placeholder.
 *
 * Actions serialize with no extra wiring here: the component produced by
 * `defineComponent` already brands its action callbacks (see
 * `internal/action-brand.ts`), and the tree host records the branded name onto
 * pressable nodes.
 */
import { createElement, type ReactNode } from "react";

import type { ActionMap } from "../authoring/actions";
import type { ComponentDefinition } from "../authoring/define-component";
import type { PropMap } from "../authoring/props";
import type { PaywallProduct, PaywallRuntimeConfig } from "../runtime/config";
import { countSlotNodes } from "../schema/validate";
import type { PaywallNode, PaywallNodeTree } from "../schema/node-tree";
import { PAYWALL_TREE_VERSION } from "../schema/node-tree";
import { renderToNodeTree } from "../tree-renderer/render-to-node-tree";
import type { SandboxHostData, SandboxProduct } from "./host-data";
import { defaultHostData } from "./host-data";

/** Inputs one preview state renders with. Mirrors the studio sandbox protocol. */
export interface RenderComponentInputs {
  /** The preview-state name recorded on the emitted tree. */
  readonly state: string;
  /** Explicit prop values, merged over the definition's declared defaults. */
  readonly props?: Record<string, unknown>;
  /** Host data (mock products/status). Defaults to {@link defaultHostData}. */
  readonly hostData?: SandboxHostData;
}

/**
 * Maps a sandbox mock product onto the runtime {@link PaywallProduct} shape.
 * A fixture may supply a full `PaywallProduct` (its `data.products` are typed
 * as such), so any already-present runtime fields (`slug`, `price`, `period`,
 * …) pass through; `slug` falls back to the id when the mock omits it.
 */
const toRuntimeProduct = (product: SandboxProduct): PaywallProduct => {
  const extra = product as Partial<PaywallProduct>;
  return {
    ...extra,
    id: product.id,
    slug: extra.slug ?? product.id,
    displayName: product.displayName,
    priceString: product.priceString,
    ...(product.trialPeriod !== undefined ? { trialPeriod: product.trialPeriod } : {}),
  };
};

/** Lowers sandbox host data into the runtime config the paywall hooks read. */
const toRuntimeConfig = (hostData: SandboxHostData): PaywallRuntimeConfig => ({
  products: hostData.products.map(toRuntimeProduct),
  variables: hostData.variables ?? {},
  locale: hostData.locale,
  platform: hostData.platform,
  safeAreaInsets: hostData.safeAreaInsets,
  dimensions: hostData.dimensions,
  ...(hostData.selectedProductId != null
    ? { defaultSelectedProductId: hostData.selectedProductId }
    : {}),
});

/**
 * Resolves the props passed to the component instance: declared defaults are
 * filled, an unset `p.ref("product")` prop is mocked from the first host
 * product (so product-driven previews render), and any extra provided props
 * pass through untouched.
 */
const resolveProps = <M extends PropMap, A extends ActionMap>(
  definition: ComponentDefinition<M, A>,
  provided: Record<string, unknown> | undefined,
  products: ReadonlyArray<PaywallProduct>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [name, builder] of Object.entries(definition.props)) {
    const schema = builder.schema;
    let value = provided?.[name];
    if (value === undefined && schema.hasDefault) {
      value = schema.defaultValue;
    }
    if (value === undefined && schema.kind === "ref" && schema.refType === "product") {
      value = products[0];
    }
    if (value !== undefined) {
      result[name] = value;
    }
  }
  if (provided) {
    for (const [key, value] of Object.entries(provided)) {
      if (!(key in result)) {
        result[key] = value;
      }
    }
  }
  return result;
};

const placeholderTree = (state: string, reason: string): PaywallNodeTree => ({
  treeVersion: PAYWALL_TREE_VERSION,
  state,
  root: { type: "placeholder", reason },
});

/**
 * Renders a component definition to a §3 preview node tree via the real
 * reconciler render path. Async because `renderToNodeTree` mounts, flushes
 * passive effects, and settles one macrotask before serializing.
 *
 * A render that produces more than one `<Slot/>` collapses to a placeholder
 * (the contract allows at most one); everything else — a throwing render, an
 * empty render — is already turned into a placeholder by `renderToNodeTree`.
 */
export const renderComponentToTree = async <M extends PropMap, A extends ActionMap>(
  definition: ComponentDefinition<M, A>,
  inputs: RenderComponentInputs,
): Promise<PaywallNodeTree> => {
  const hostData = inputs.hostData ?? defaultHostData();
  const config = toRuntimeConfig(hostData);
  const props = resolveProps(definition, inputs.props, config.products);

  // Props are resolved dynamically (defaults + provided + product mocks), so
  // the component is invoked through its untyped call signature.
  const Component = definition.component as (props: Record<string, unknown>) => ReactNode;
  const element = createElement(Component, props);
  const tree = await renderToNodeTree(element, { config, state: inputs.state });

  if (countSlotNodes(tree.root as PaywallNode) > 1) {
    return placeholderTree(inputs.state, "a component may declare at most one <Slot />");
  }
  return tree;
};

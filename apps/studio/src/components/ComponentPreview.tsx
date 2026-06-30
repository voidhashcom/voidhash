import {
  type ActionMap,
  type ComponentPreviewState,
  type InferComponentProps,
  type PaywallProduct,
  type PaywallRuntimeConfig,
  PaywallRuntimeProvider,
  type PropMap,
  type PropSchema,
  RendererProvider,
} from "@voidhash/paywalls";
import { createElement, type ReactNode } from "react";

import type { AnyComponentDefinition } from "../voidhash/paywalls";
import { DEFAULT_PREVIEW_CONFIG, SILENT_BRIDGE } from "../voidhash/preview-runtime";
import { PreviewErrorBoundary } from "./PreviewErrorBoundary";

const PLACEHOLDER_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="8" fill="#d4d4d4"/></svg>',
)}`;

/** Best-effort value for a required prop with no fixture and no default. */
const placeholderValue = (schema: PropSchema, products: ReadonlyArray<PaywallProduct>): unknown => {
  switch (schema.kind) {
    case "string":
      return schema.label ?? "Text";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "select":
      return schema.options?.[0] ?? "";
    case "image":
      return PLACEHOLDER_IMAGE;
    case "ref":
      // Only `ref("product")` exists in Phase 1: fall back to the first mock
      // product when the default preview state declares no fixture.
      return products[0];
    case "component":
      return null;
    case "array":
      return [];
    default:
      return;
  }
};

/** The "default" preview state, or the first declared one as a stand-in. */
const defaultPreviewState = (
  definition: AnyComponentDefinition,
): ComponentPreviewState<PropMap> | undefined =>
  definition.previews.default ?? Object.values(definition.previews)[0];

/** Mock runtime config, overridden by the preview state's declared data. */
const previewConfig = (
  state: ComponentPreviewState<PropMap> | undefined,
): PaywallRuntimeConfig => ({
  ...DEFAULT_PREVIEW_CONFIG,
  products: state?.data?.products ?? DEFAULT_PREVIEW_CONFIG.products,
  variables: state?.data?.variables ?? DEFAULT_PREVIEW_CONFIG.variables,
});

/**
 * Resolves the props to mount a component preview with: declared preview-state
 * fixtures first, then schema defaults, then best-effort placeholders for
 * whatever required props remain (optional props stay unset).
 */
const buildPreviewProps = (
  definition: AnyComponentDefinition,
  state: ComponentPreviewState<PropMap> | undefined,
  products: ReadonlyArray<PaywallProduct>,
): Record<string, unknown> => {
  const fixtures: Record<string, unknown> = state?.props ?? {};
  const props: Record<string, unknown> = {};
  for (const [name, builder] of Object.entries(definition.props)) {
    if (fixtures[name] !== undefined) {
      props[name] = fixtures[name];
      continue;
    }
    const schema = builder.schema;
    if (schema.hasDefault) {
      props[name] = schema.defaultValue;
    } else if (!schema.optional) {
      props[name] = placeholderValue(schema, products);
    }
  }
  return props;
};

export interface ComponentPreviewProps {
  definition: AnyComponentDefinition;
}

/**
 * A best-effort static preview of a `defineComponent(...)` definition: mounts
 * `definition.component` with its default-preview props inside the same
 * renderer + runtime providers a real paywall renders under, against the mock
 * Studio config (envelopes go to a silent bridge).
 */
export const ComponentPreview = ({ definition }: ComponentPreviewProps): ReactNode => {
  const state = defaultPreviewState(definition);
  const config = previewConfig(state);
  const props = buildPreviewProps(definition, state, config.products);

  return (
    <div className="overflow-hidden rounded-md bg-neutral-800 p-2">
      <PreviewErrorBoundary
        fallback={(error) => (
          <p className="break-words px-1 py-0.5 text-[11px] text-red-400">
            Failed to render: {error.message}
          </p>
        )}
      >
        <RendererProvider>
          <PaywallRuntimeProvider bridge={SILENT_BRIDGE} config={config}>
            {createElement(
              definition.component,
              // Safe: the definition's prop/action generics are erased for
              // dynamically discovered components; the props are best-effort
              // fixtures built from its own schemas above.
              props as InferComponentProps<PropMap, ActionMap>,
            )}
          </PaywallRuntimeProvider>
        </RendererProvider>
      </PreviewErrorBoundary>
    </div>
  );
};

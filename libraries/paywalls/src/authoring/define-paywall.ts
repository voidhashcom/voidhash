import type { ReactNode } from "react";

/** Identity metadata attached to every paywall composition definition. */
export interface PaywallCompositionMeta {
  readonly kind: "paywall-composition";
}

/**
 * The input to {@link definePaywall}: exactly a `render` callback returning the
 * paywall's `<Screen>`. A plain object type (no index signature) so any unknown
 * key is an excess-property error at author time.
 */
export interface DefinePaywallInput {
  /** Returns the paywall's root `<Screen>` element; run in previews. */
  readonly render: () => ReactNode;
}

/**
 * An inert paywall-definition shape: identity metadata plus a `render` callback.
 *
 * Paywalls are authored as mimic documents (visually and via schema-validated
 * edit ops), not as code — this shape is retained only as a stable, inert
 * author/runtime surface for rendering a `render` callback in previews.
 */
export interface PaywallCompositionDefinition {
  readonly __voidhash: PaywallCompositionMeta;
  readonly render: () => ReactNode;
}

/**
 * Wraps a `render` callback as an inert {@link PaywallCompositionDefinition}.
 * The returned value is plain data; nothing parses it. Retained as a stable
 * export; paywalls are authored as documents, not code.
 */
export const definePaywall = (input: DefinePaywallInput): PaywallCompositionDefinition => ({
  __voidhash: { kind: "paywall-composition" },
  render: input.render,
});

/** Type guard for a {@link PaywallCompositionDefinition}. */
export const isPaywallCompositionDefinition = (
  value: unknown,
): value is PaywallCompositionDefinition =>
  typeof value === "object" &&
  value !== null &&
  (value as { __voidhash?: PaywallCompositionMeta }).__voidhash?.kind === "paywall-composition" &&
  typeof (value as { render?: unknown }).render === "function";

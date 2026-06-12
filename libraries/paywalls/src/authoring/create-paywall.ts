import { createElement, type ReactNode } from "react";

import type { PaywallVariables } from "../runtime/config";

/**
 * The body of a paywall: a static tree, or a component function (so it may use
 * runtime hooks such as `usePaywallProducts`).
 */
export type PaywallBody = ReactNode | (() => ReactNode);

export interface CreatePaywallInput {
  /** Display name shown in Studio and the dashboard. */
  readonly title: string;
  /** Optional longer description for the dashboard. */
  readonly description?: string;
  /** Product slugs the paywall uses. Drives the SDK's injected product list. */
  readonly products?: ReadonlyArray<string>;
  /** Author variables (dashboard/experiment overridable). */
  readonly variables?: PaywallVariables;
  /** The paywall's content. */
  readonly render: PaywallBody;
}

/** Metadata attached to every value produced by {@link createPaywall}. */
export interface PaywallMeta {
  readonly kind: "paywall";
  readonly title: string;
  readonly description?: string;
  readonly products: ReadonlyArray<string>;
  readonly variables: PaywallVariables;
}

/**
 * The object returned by {@link createPaywall}. It is intentionally inert
 * data — rendering is performed by `PaywallRenderer` / `mountPaywall` so the
 * same definition can be previewed in Studio and bundled for a device.
 */
export interface PaywallDefinition extends CreatePaywallInput {
  readonly __voidhash: PaywallMeta;
}

/**
 * Declares a paywall. The result is exported as the module default and picked
 * up by the CLI (Studio preview + deploy bundling).
 *
 * ```tsx
 * export default createPaywall({
 *   title: "Onboarding",
 *   products: ["yearly", "monthly"],
 *   variables: { accentColor: "#16a34a" },
 *   render: () => <View>…</View>,
 * });
 * ```
 */
export const createPaywall = (
  input: CreatePaywallInput,
): PaywallDefinition => ({
  ...input,
  __voidhash: {
    kind: "paywall",
    title: input.title,
    description: input.description,
    products: input.products ?? [],
    variables: input.variables ?? {},
  },
});

/** Type guard for a {@link PaywallDefinition}. */
export const isPaywallDefinition = (
  value: unknown,
): value is PaywallDefinition =>
  typeof value === "object" &&
  value !== null &&
  (value as { __voidhash?: PaywallMeta }).__voidhash?.kind === "paywall";

/**
 * Normalizes a {@link PaywallBody} to a renderable element, wrapping a
 * function body in a component element so it may use hooks.
 */
export const renderPaywallBody = (body: PaywallBody): ReactNode =>
  typeof body === "function" ? createElement(body as () => ReactNode) : body;

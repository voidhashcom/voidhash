/**
 * The design-time host data a component renders against in the studio sandbox.
 *
 * This is the sandbox's fixture vocabulary: mock products plus presentation
 * context (locale, platform, status). Preview states override it per
 * `defineComponent({ previews: { <state>: { data } } })`. It is intentionally a
 * simpler shape than the full runtime {@link PaywallRuntimeConfig} — the
 * sandbox maps it into a runtime config before rendering.
 */

/**
 * A resolved product as delivered to components in the studio preview. On a
 * device the native SDK supplies richer {@link PaywallProduct} values; the
 * sandbox mocks the fields authors commonly read.
 */
export interface SandboxProduct {
  readonly id: string;
  readonly displayName: string;
  readonly priceString: string;
  readonly trialPeriod?: string;
}

/** Author-configurable values the dashboard/experiments override at runtime. */
export type SandboxVariables = Readonly<Record<string, string | number | boolean>>;

/**
 * Host data injected into a component render in the studio preview. Mock
 * values, overridable per preview state via `defineComponent({ previews })`.
 */
export interface SandboxHostData {
  readonly products: ReadonlyArray<SandboxProduct>;
  readonly selectedProductId: string | null;
  /** Author variables (`usePaywallVariables`), overridable per preview state. */
  readonly variables: SandboxVariables;
  readonly locale: string;
  readonly platform: "ios" | "android" | "web";
}

/** Default mock host data used when a preview fixture supplies none. */
export const defaultHostData = (): SandboxHostData => ({
  locale: "en-US",
  platform: "ios",
  products: [
    { displayName: "Yearly", id: "yearly", priceString: "$39.99", trialPeriod: "7 days" },
    { displayName: "Monthly", id: "monthly", priceString: "$4.99" },
  ],
  selectedProductId: "yearly",
  variables: {},
});

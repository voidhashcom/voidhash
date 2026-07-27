/// <reference types="vite/client" />

declare module "virtual:voidhash-paywalls" {
  import type { PaywallDefinition } from "@voidhash/paywalls";

  interface RawEntry {
    readonly id: string;
    readonly file: string;
    readonly module: { readonly default?: unknown } & Record<string, unknown>;
  }

  /** Absolute path to the user's project root. */
  export const projectRoot: string;
  /** Every paywall discovered under `.voidhash/paywalls`. */
  export const paywalls: ReadonlyArray<RawEntry>;
  /** Every reusable component discovered under `.voidhash/components`. */
  export const components: ReadonlyArray<RawEntry>;

  export type { PaywallDefinition };
}

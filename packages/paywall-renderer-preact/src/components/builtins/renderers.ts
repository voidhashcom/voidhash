import { SampleBadge } from "./sample-badge";
import type { BuiltinRenderer } from "./types";

/**
 * The built-in component implementations shipped with this renderer, keyed by
 * their stable slug. Keys mirror the `BUILTIN_COMPONENTS` metadata registry in
 * `@voidhash/paywall-builtins` (asserted by test); an instance whose slug
 * is missing here degrades to the same placeholder as an unresolvable catalog
 * component.
 */
export const BUILTIN_RENDERERS: Readonly<Record<string, BuiltinRenderer>> = {
  "sample-badge": SampleBadge,
};

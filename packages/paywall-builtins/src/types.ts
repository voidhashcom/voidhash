import type { ComponentPropBinding } from "@voidhash/mimic-schema";
import type { ComponentManifest } from "@voidhash/paywalls/schema";

/**
 * A document prop entry seeded onto a builtin `component` node at insertion —
 * the exact `{name, value}` shape of `componentNodeData.props` entries, so
 * insertion code can pass `defaultProps` to the document write unchanged.
 */
export interface BuiltinDefaultProp {
  readonly name: string;
  readonly value: ComponentPropBinding;
}

/**
 * A first-party component that ships with the paywall renderer. Builtins are
 * placed as `component` nodes with `componentSource: "builtin"`, resolved by
 * their stable `slug` and UNPINNED (no `componentVersion`/`contentHash` — the
 * implementation evolves with renderer releases). They are never compiled
 * from user source and have no catalog rows; the `manifest` reuses the same
 * §2 {@link ComponentManifest} shape catalog/local components describe
 * themselves with, so designer panels, the component browser, and the AI
 * surface consume all three sources uniformly.
 */
export interface BuiltinComponentDefinition {
  /** Stable slug the renderer resolves the implementation by. */
  readonly slug: string;
  /** Human-readable display name for panels and the component browser. */
  readonly name: string;
  /** Short description for the component browser and the AI surface. */
  readonly description: string;
  /** The component's §2 manifest (props/actions/slot/previewStates). */
  readonly manifest: ComponentManifest;
  /** Document prop entries seeded when the builtin is inserted. */
  readonly defaultProps: ReadonlyArray<BuiltinDefaultProp>;
}

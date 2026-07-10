/**
 * Builds the component-description message the sandbox posts to the host after
 * loading a compiled component. It carries the strict §2 {@link ComponentManifest}
 * plus a sibling `hasPanel` boolean — whether the definition declared a custom
 * editor panel (`defineComponent({ panel })`).
 *
 * `hasPanel` is deliberately kept OUT of {@link ComponentManifest} (the strict,
 * server-validated wire contract): it is host-only preview metadata, read as a
 * sibling of `manifest`, so adding it never widens the validated schema. A
 * panel definition is a live function that never crosses the sandbox boundary;
 * only this flag does, and the host then drives it through a panel session
 * inside the sandbox.
 */
import type { ActionMap } from "../authoring/actions";
import type { ComponentDefinition } from "../authoring/define-component";
import { extractComponentManifest } from "../authoring/manifest";
import type { PropMap } from "../authoring/props";
import type { ComponentManifest } from "../schema/component-manifest";

/** Whether a definition declared a custom editor panel. */
export const definitionHasPanel = <M extends PropMap, A extends ActionMap>(
  definition: ComponentDefinition<M, A>,
): boolean => typeof definition.panel === "function";

/** The manifest-plus-`hasPanel` message the sandbox posts alongside previews. */
export interface ComponentDescription {
  readonly manifest: ComponentManifest;
  /** Sibling of `manifest`; NOT part of the strict manifest schema. */
  readonly hasPanel: boolean;
}

/**
 * Extracts the §2 manifest and the sibling `hasPanel` flag from a definition.
 * The host posts this as the component-description message.
 */
export const describeComponent = <M extends PropMap, A extends ActionMap>(
  definition: ComponentDefinition<M, A>,
): ComponentDescription => ({
  manifest: extractComponentManifest(definition),
  hasPanel: definitionHasPanel(definition),
});

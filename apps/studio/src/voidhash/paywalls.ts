import {
  components as rawComponents,
  paywalls as rawPaywalls,
  projectRoot as rawProjectRoot,
} from "virtual:voidhash-paywalls";
import {
  type ActionMap,
  type ComponentDefinition,
  type ComponentManifest,
  extractComponentManifest,
  isComponentDefinition,
  isPaywallDefinition,
  type PaywallDefinition,
  type PropMap,
} from "@voidhash/paywalls";

/**
 * A component definition with its prop/action generics erased — the shape of
 * definitions discovered dynamically from the user's project.
 */
export type AnyComponentDefinition = ComponentDefinition<PropMap, ActionMap>;

/** A paywall ready to preview, with its source location. */
export interface PaywallEntry {
  readonly id: string;
  readonly file: string;
  readonly title: string;
  readonly definition: PaywallDefinition;
}

/** A reusable component discovered in the project, with its editor metadata. */
export interface ComponentEntry {
  readonly id: string;
  readonly file: string;
  /** The `defineComponent(...)` export, or null when the file has none. */
  readonly definition: AnyComponentDefinition | null;
  /** The extracted §2 manifest, or null when extraction failed. */
  readonly manifest: ComponentManifest | null;
}

/** An entry whose default export failed to be a valid paywall definition. */
export interface InvalidEntry {
  readonly id: string;
  readonly file: string;
  readonly reason: string;
}

export interface ProjectContent {
  readonly projectRoot: string;
  readonly paywalls: ReadonlyArray<PaywallEntry>;
  readonly components: ReadonlyArray<ComponentEntry>;
  readonly invalid: ReadonlyArray<InvalidEntry>;
}

/**
 * Finds the `defineComponent(...)` result in a component module: the default
 * export by convention, falling back to the first matching named export
 * (authors commonly `export const definition = defineComponent(...)`).
 */
const findComponentDefinition = (
  module: { readonly default?: unknown } & Record<string, unknown>,
): AnyComponentDefinition | null => {
  if (isComponentDefinition(module.default)) {
    return module.default;
  }
  for (const value of Object.values(module)) {
    if (isComponentDefinition(value)) {
      return value;
    }
  }
  return null;
};

const safeManifest = (definition: AnyComponentDefinition): ComponentManifest | null => {
  try {
    return extractComponentManifest(definition);
  } catch {
    // A structurally valid definition with hand-rolled (non-builder) props can
    // still blow up extraction; the sidebar then just omits the metadata.
    return null;
  }
};

/**
 * Normalizes the raw `virtual:voidhash-paywalls` module into typed, validated
 * collections for the UI. Paywalls whose default export isn't a valid
 * `createPaywall(...)` result are surfaced as {@link InvalidEntry} rather than
 * crashing the preview.
 */
export const loadProjectContent = (): ProjectContent => {
  const paywalls: PaywallEntry[] = [];
  const invalid: InvalidEntry[] = [];

  for (const entry of rawPaywalls) {
    const def = entry.module.default;
    if (isPaywallDefinition(def)) {
      paywalls.push({
        definition: def,
        file: entry.file,
        id: entry.id,
        title: def.title || entry.id,
      });
    } else {
      invalid.push({
        file: entry.file,
        id: entry.id,
        reason:
          "Default export is not a paywall. Did you forget `export default createPaywall(...)`?",
      });
    }
  }

  const components: ComponentEntry[] = rawComponents.map((entry) => {
    const definition = findComponentDefinition(entry.module);
    return {
      definition,
      file: entry.file,
      id: entry.id,
      manifest: definition ? safeManifest(definition) : null,
    };
  });

  return {
    components,
    invalid,
    paywalls: paywalls.sort((a, b) => a.title.localeCompare(b.title)),
    projectRoot: rawProjectRoot,
  };
};

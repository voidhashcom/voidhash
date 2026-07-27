import { sampleBadge } from "./sample-badge.ts";
import type { BuiltinComponentDefinition } from "./types.ts";

/**
 * The registry of built-in component definitions, keyed by their stable slug.
 * This is the single metadata source for designer panels, the component
 * browser, and the AI surface; the renderer keeps a parallel slug → preact
 * component map for the implementations.
 */
export const BUILTIN_COMPONENTS: Readonly<Record<string, BuiltinComponentDefinition>> = {
  [sampleBadge.slug]: sampleBadge,
};

/**
 * Looks up a built-in component definition by its stable slug. Returns
 * undefined for unknown slugs — callers degrade to the same placeholder
 * behavior as an unresolvable catalog component.
 */
export function getBuiltinComponent(slug: string): BuiltinComponentDefinition | undefined {
  return BUILTIN_COMPONENTS[slug];
}

/** Lists every built-in component definition, in registry order. */
export function listBuiltinComponents(): ReadonlyArray<BuiltinComponentDefinition> {
  return Object.values(BUILTIN_COMPONENTS);
}

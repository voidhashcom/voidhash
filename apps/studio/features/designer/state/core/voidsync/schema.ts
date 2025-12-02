/** biome-ignore-all lint/suspicious/noExplicitAny: generic */
import type {
  AnyEffectSchema,
  VoidsyncFieldSchema,
  VoidsyncSchema,
  VoidsyncSchemaInput
} from './types';

/**
 * Creates a typed schema definition for a Voidsync store.
 * Uses Effect Schema for awareness and browser state validation.
 *
 * @example
 * const schema = createVoidsyncSchema({
 *   awareness: Schema.Struct({
 *     cursor: Schema.NullOr(Schema.Struct({ x: Schema.Number, y: Schema.Number }))
 *   }),
 *   browser: Schema.Struct({
 *     selectedId: Schema.NullOr(Schema.String)
 *   }),
 *   synced: {
 *     nodes: syncMap<NodeData>(),
 *     layers: syncArray<string>(),
 *     title: syncText()
 *   }
 * });
 */
export function createVoidsyncSchema<
  TAwareness extends AnyEffectSchema,
  TBrowser extends AnyEffectSchema,
  TSynced extends Record<string, VoidsyncFieldSchema>
>(
  input: VoidsyncSchemaInput<TAwareness, TBrowser, TSynced>
): VoidsyncSchema<TAwareness, TBrowser, TSynced> {
  return {
    awareness: input.awareness,
    browser: input.browser,
    synced: input.synced,
    // _types is only for type inference, never used at runtime
    _types: {} as any
  };
}

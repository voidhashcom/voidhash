/** biome-ignore-all lint/suspicious/noExplicitAny: generic */
import type { z } from 'zod';
import type {
  VoidsyncFieldSchema,
  VoidsyncSchema,
  VoidsyncSchemaInput
} from './types';

/**
 * Creates a typed schema definition for a Voidsync store.
 *
 * @example
 * const schema = createVoidsyncSchema({
 *   awareness: z.object({
 *     cursor: z.object({ x: z.number(), y: z.number() }).nullable()
 *   }),
 *   browser: z.object({
 *     selectedId: z.string().nullable()
 *   }),
 *   synced: {
 *     nodes: syncMap(z.object({ x: z.number(), y: z.number() })),
 *     layers: syncArray(z.string()),
 *     title: syncText()
 *   }
 * });
 */
export function createVoidsyncSchema<
  TAwareness extends z.ZodTypeAny,
  TBrowser extends z.ZodTypeAny,
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

import { z } from 'zod';
import {
  type VoidsyncFieldSchema,
  type VoidsyncTypeMarker,
  VOIDSYNC_TYPE_KEY
} from './types';

/**
 * Mark a field as backed by Y.Map (synced as Record<string, T>)
 */
export function syncMap<TValue extends z.ZodTypeAny>(
  valueSchema: TValue
): VoidsyncFieldSchema<'map'> & { _type: Record<string, z.infer<TValue>> } {
  return {
    [VOIDSYNC_TYPE_KEY]: 'map',
    schema: valueSchema,
    _type: {} as Record<string, z.infer<TValue>>
  };
}

/**
 * Mark a field as backed by Y.Array (synced as T[])
 */
export function syncArray<TItem extends z.ZodTypeAny>(
  itemSchema: TItem
): VoidsyncFieldSchema<'array'> & { _type: z.infer<TItem>[] } {
  return {
    [VOIDSYNC_TYPE_KEY]: 'array',
    schema: itemSchema,
    _type: [] as z.infer<TItem>[]
  };
}

/**
 * Mark a field as backed by Y.Text (synced as string, for rich text editing)
 */
export function syncText(): VoidsyncFieldSchema<'text'> & { _type: string } {
  return {
    [VOIDSYNC_TYPE_KEY]: 'text',
    schema: z.string(),
    _type: '' as string
  };
}

/**
 * Type guard to check if a value is a VoidsyncFieldSchema
 */
export function isVoidsyncFieldSchema(
  value: unknown
): value is VoidsyncFieldSchema {
  return (
    typeof value === 'object' && value !== null && VOIDSYNC_TYPE_KEY in value
  );
}

/**
 * Get the sync type marker from a field schema
 */
export function getVoidsyncTypeMarker(
  field: VoidsyncFieldSchema
): VoidsyncTypeMarker {
  return field[VOIDSYNC_TYPE_KEY];
}

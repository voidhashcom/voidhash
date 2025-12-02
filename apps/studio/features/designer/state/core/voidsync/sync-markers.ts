import {
  VOIDSYNC_TYPE_KEY,
  type VoidsyncFieldSchema,
  type VoidsyncTypeMarker
} from './types';

/**
 * Mark a field as backed by Y.Map (synced as Record<string, T>)
 * The type parameter defines the value type stored in the map.
 */
export function syncMap<TValue>(): VoidsyncFieldSchema<
  'map',
  Record<string, TValue>
> {
  return {
    [VOIDSYNC_TYPE_KEY]: 'map',
    _type: {} as Record<string, TValue>
  };
}

/**
 * Mark a field as backed by Y.Array (synced as T[])
 * The type parameter defines the item type stored in the array.
 */
export function syncArray<TItem>(): VoidsyncFieldSchema<'array', TItem[]> {
  return {
    [VOIDSYNC_TYPE_KEY]: 'array',
    _type: [] as TItem[]
  };
}

/**
 * Mark a field as backed by Y.Text (synced as string, for rich text editing)
 */
export function syncText(): VoidsyncFieldSchema<'text', string> {
  return {
    [VOIDSYNC_TYPE_KEY]: 'text',
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

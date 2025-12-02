/** biome-ignore-all lint/suspicious/noExplicitAny: generic */

import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import { createStore } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { getVoidsyncTypeMarker, isVoidsyncFieldSchema } from './sync-markers';
import {
  ACTION_CALL_SYMBOL,
  type Action,
  type ActionCall,
  type ActionFn,
  type AnyEffectSchema,
  type InferSchemaType,
  type InferSyncedRecord,
  type InitialStateInput,
  type SyncFromDoc,
  type VoidsyncFieldSchema,
  type VoidsyncSchema,
  type VoidsyncState
} from './types';

/**
 * Generates a sync function automatically from the synced schema.
 * Each key in the schema is mapped to its corresponding shared type:
 * - syncMap() → Y.Map
 * - syncArray() → Y.Array
 * - syncText() → Y.Text
 */
function createAutoSyncFromSchema<
  TSynced extends Record<string, VoidsyncFieldSchema>
>(syncedSchema: TSynced): SyncFromDoc<InferSyncedRecord<TSynced>, Y.Doc> {
  return (doc, set) => {
    const state: Record<string, unknown> = {};

    for (const [key, fieldSchema] of Object.entries(syncedSchema)) {
      if (!isVoidsyncFieldSchema(fieldSchema)) {
        continue;
      }

      const marker = getVoidsyncTypeMarker(fieldSchema);

      switch (marker) {
        case 'map': {
          const ymap = doc.getMap(key);
          const record: Record<string, unknown> = {};
          for (const [k, v] of ymap.entries()) {
            record[k] = v;
          }
          state[key] = record;
          break;
        }
        case 'array': {
          const yarray = doc.getArray(key);
          state[key] = yarray.toArray();
          break;
        }
        case 'text': {
          const ytext = doc.getText(key);
          state[key] = ytext.toString();
          break;
        }
      }
    }

    set(state as Partial<InferSyncedRecord<TSynced>>);
  };
}

/**
 * Creates the base store state with a curried API.
 *
 * @example
 * const storeState = createVoidsyncState(schema)(
 *   {
 *     awareness: { cursor: null },
 *     browser: { selectedId: null }
 *   },
 *   doc,
 *   awareness
 * );
 */
function createVoidsyncStateFn<TSchema extends VoidsyncSchema<any, any, any>>(
  schema: TSchema
) {
  return <TYdoc extends Y.Doc>(
    initialState: InitialStateInput<TSchema>,
    doc: TYdoc,
    awareness: Awareness,
    /**
     * Optional custom sync function. If not provided, sync is auto-generated
     * from the synced schema using syncMap/syncArray/syncText markers.
     */
    syncFromDoc?: SyncFromDoc<TSchema['_types']['synced'], TYdoc>
  ): VoidsyncState<TSchema, TYdoc> => {
    // Use auto-generated sync if not provided
    const effectiveSyncFromDoc =
      syncFromDoc ?? createAutoSyncFromSchema(schema.synced);

    // Create the zustand store internally with the combined initial state
    const combinedInitialState = {
      ...(initialState.awareness as object),
      ...(initialState.browser as object)
    } as TSchema['_types']['combined'];

    const zustand = createStore<TSchema['_types']['combined']>()(
      subscribeWithSelector(() => combinedInitialState)
    );

    // Set initial awareness state
    for (const [key, value] of Object.entries(
      initialState.awareness as Record<string, unknown>
    )) {
      awareness.setLocalStateField(key, value);
    }

    // Action factory with types bound to this store's schema
    function action<TParamsSchema extends AnyEffectSchema, TReturn = void>(
      paramsSchema: TParamsSchema,
      fn: ActionFn<TSchema, TYdoc, InferSchemaType<TParamsSchema>, TReturn>
    ): Action<TSchema, TYdoc, InferSchemaType<TParamsSchema>, TReturn>;
    function action<TReturn = void>(
      fn: ActionFn<TSchema, TYdoc, void, TReturn>
    ): Action<TSchema, TYdoc, void, TReturn>;
    function action<TParamsSchema extends AnyEffectSchema, TReturn = void>(
      paramsSchemaOrFn: TParamsSchema | ActionFn<TSchema, TYdoc, void, TReturn>,
      maybeFn?: ActionFn<
        TSchema,
        TYdoc,
        InferSchemaType<TParamsSchema>,
        TReturn
      >
    ): Action<TSchema, TYdoc, any, any> {
      // Create the call method for type-safe dispatch
      const createCallMethod = (
        actionRef: Action<TSchema, TYdoc, any, any>
      ): ((params: any) => ActionCall<any, any>) => {
        return (params: any): ActionCall<any, any> => ({
          [ACTION_CALL_SYMBOL]: true,
          action: actionRef,
          params
        });
      };

      // Check if we have two arguments (schema + fn) or just one (fn only)
      // We check for maybeFn because Effect Schemas are also typeof 'function'
      // (they are class constructors), so we can't rely on typeof alone
      if (maybeFn !== undefined) {
        // First arg is schema, second is fn
        const actionObj: Action<TSchema, TYdoc, any, TReturn> = {
          fn: maybeFn,
          paramsSchema: paramsSchemaOrFn as TParamsSchema,
          call: null as any // Will be set below
        };
        (actionObj as any).call = createCallMethod(actionObj);
        return actionObj;
      }

      // Single argument - must be the action function (no params schema)
      if (typeof paramsSchemaOrFn !== 'function') {
        throw new Error('Action requires a function');
      }
      const actionObj: Action<TSchema, TYdoc, void, TReturn> = {
        fn: paramsSchemaOrFn,
        paramsSchema: null,
        call: null as any // Will be set below
      };
      (actionObj as any).call = createCallMethod(actionObj);
      return actionObj;
    }

    return {
      zustand,
      doc,
      awareness,
      schema,
      syncFromDoc: effectiveSyncFromDoc,
      action
    };
  };
}

export const createVoidsyncState = createVoidsyncStateFn;

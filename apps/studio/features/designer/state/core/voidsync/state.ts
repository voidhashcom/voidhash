/** biome-ignore-all lint/suspicious/noExplicitAny: generic */

import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import type { z } from 'zod';
import { createStore } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { getVoidsyncTypeMarker, isVoidsyncFieldSchema } from './sync-markers';
import {
  ACTION_CALL_SYMBOL,
  type Action,
  type ActionCall,
  type ActionFn,
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
      ...initialState.awareness,
      ...initialState.browser
    } as TSchema['_types']['combined'];

    const zustand = createStore<TSchema['_types']['combined']>()(
      subscribeWithSelector(() => combinedInitialState)
    );

    // Set initial awareness state
    for (const [key, value] of Object.entries(initialState.awareness)) {
      awareness.setLocalStateField(key, value);
    }

    // Action factory with types bound to this store's schema
    function action<TParamsSchema extends z.ZodTypeAny>(
      paramsSchema: TParamsSchema,
      fn: ActionFn<TSchema, TYdoc, z.infer<TParamsSchema>>
    ): Action<TSchema, TYdoc, z.infer<TParamsSchema>>;
    function action(
      fn: ActionFn<TSchema, TYdoc, void>
    ): Action<TSchema, TYdoc, void>;
    function action<TParamsSchema extends z.ZodTypeAny>(
      paramsSchemaOrFn: TParamsSchema | ActionFn<TSchema, TYdoc, void>,
      maybeFn?: ActionFn<TSchema, TYdoc, z.infer<TParamsSchema>>
    ): Action<TSchema, TYdoc, any> {
      // Create the call method for type-safe dispatch
      const createCallMethod = (
        actionRef: Action<TSchema, TYdoc, any>
      ): ((params: any) => ActionCall<any>) => {
        return (params: any): ActionCall<any> => ({
          [ACTION_CALL_SYMBOL]: true,
          action: actionRef,
          params
        });
      };

      // Check if first arg is a function (no params schema)
      if (typeof paramsSchemaOrFn === 'function') {
        const actionObj: Action<TSchema, TYdoc, void> = {
          fn: paramsSchemaOrFn,
          paramsSchema: null,
          call: null as any // Will be set below
        };
        (actionObj as any).call = createCallMethod(actionObj);
        return actionObj;
      }

      // First arg is schema, second is fn
      const actionObj: Action<TSchema, TYdoc, any> = {
        fn:
          maybeFn ??
          (() => {
            throw new Error('No function provided for action');
          }),
        paramsSchema: paramsSchemaOrFn,
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

/** biome-ignore-all lint/suspicious/noExplicitAny: generic */
import type * as Y from 'yjs';
import { useMemo, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import type {
  Action,
  ActionContext,
  AnyAction,
  AwarenessStates,
  VoidsyncSchema,
  VoidsyncStore
} from './types';

/**
 * React hook to select state from a Voidsync store.
 * Re-renders when the selected state changes.
 *
 * @example
 * const nodes = useVoidsyncSelect(store, (state) => state.nodes);
 * const selectedId = useVoidsyncSelect(store, (state) => state.selectedId);
 */
export const useVoidsyncSelect = <
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TActions extends Record<string, AnyAction>,
  TResult
>(
  store: VoidsyncStore<TSchema, TYdoc, TActions>,
  selector: (state: TSchema['_types']['combined']) => TResult
): TResult => {
  return useStore(store.zustand, selector);
};

/**
 * React hook to get all users' awareness states.
 * Re-renders when any user's awareness state changes.
 * Returns a Map<clientId, awarenessState>.
 *
 * @example
 * const awarenessStates = useVoidsyncAwareness(store);
 * const otherUsers = Array.from(awarenessStates.entries())
 *   .filter(([id]) => id !== store.clientId);
 */
export const useVoidsyncAwareness = <
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TActions extends Record<string, AnyAction>
>(
  store: VoidsyncStore<TSchema, TYdoc, TActions>
): AwarenessStates<TSchema['_types']['awareness']> => {
  const subscribe = useMemo(
    () => (callback: () => void) => {
      store.awareness.on('change', callback);
      return () => {
        store.awareness.off('change', callback);
      };
    },
    [store.awareness]
  );

  const getSnapshot = useMemo(
    () => () => store.awareness.getStates(),
    [store.awareness]
  );

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot // Server snapshot (same as client for this use case)
  ) as AwarenessStates<TSchema['_types']['awareness']>;
};

/**
 * React hook to get a dispatch function for store actions.
 * The dispatch function is type-safe based on the store's action definitions.
 *
 * @example
 * const dispatch = useVoidsyncActions(store);
 * dispatch('addNode', { x: 100, y: 200 });
 * dispatch('resetSelection'); // void action
 */
export const useVoidsyncActions = <
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TActions extends Record<string, AnyAction>
>(
  store: VoidsyncStore<TSchema, TYdoc, TActions>
) => {
  return <TName extends keyof TActions>(
    name: TName,
    params: TActions[TName] extends Action<any, any, infer P> ? P : never
  ) => {
    const action = store.actions[name];
    if (action) {
      const ctx: ActionContext<TSchema, TYdoc, typeof params> = {
        doc: store.doc,
        awareness: store.awareness,
        getState: () => store.zustand.getState(),
        setBrowser: (state) => {
          store.zustand.setState(
            state as Partial<TSchema['_types']['combined']>
          );
        },
        setAwareness: (state) => {
          for (const [key, value] of Object.entries(state)) {
            store.awareness.setLocalStateField(key, value);
          }
          // Also update zustand for local reactivity
          store.zustand.setState(
            state as Partial<TSchema['_types']['combined']>
          );
        },
        params
      };
      action.fn(ctx);
    }
  };
};

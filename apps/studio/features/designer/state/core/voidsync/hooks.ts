/** biome-ignore-all lint/suspicious/noExplicitAny: generic */

import { useMemo, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import { useStore } from 'zustand';
import type {
  ActionContext,
  ActionDispatchFn,
  ActionFactory,
  AnyAction,
  AwarenessStates,
  HookDispatchFn,
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

export const useVoidsyncSubscribe = <
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TActions extends Record<string, AnyAction>,
  TResult
>(
  store: VoidsyncStore<TSchema, TYdoc, TActions>,
  selector: (state: TSchema['_types']['combined']) => TResult,
  callback: (state: TResult) => void
): (() => void) => {
  return store.zustand.subscribe(selector, callback);
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
 * Creates the action dispatch function for use within action handlers.
 * Accepts action factory functions.
 *
 * @example
 * dispatch(unselectNode)({ id: '123' });
 * dispatch(clearSelection)();
 */
function createActionDispatch<
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TActions extends Record<string, AnyAction>
>(
  store: VoidsyncStore<TSchema, TYdoc, TActions>,
  executeAction: (action: AnyAction, params: unknown) => void
): ActionDispatchFn<TSchema, TYdoc> {
  return <TParams,>(
    actionFactory: ActionFactory<TSchema, TYdoc, TParams>
  ): ((params: TParams) => void) => {
    return (params: TParams) => {
      // Call the factory with storeState to get the action
      const action = actionFactory(store.storeState);
      executeAction(action, params);
    };
  };
}

/**
 * Creates the hook dispatch function for use from React components.
 * Accepts string action names.
 *
 * @example
 * dispatch('selectNode', { id: '123', many: false });
 */
function createHookDispatch<
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TActions extends Record<string, AnyAction>
>(
  store: VoidsyncStore<TSchema, TYdoc, TActions>,
  executeAction: (action: AnyAction, params: unknown) => void
): HookDispatchFn<TActions> {
  return <TName extends keyof TActions>(name: TName, params: unknown): void => {
    const action = store.actions[name];
    if (action) {
      executeAction(action, params);
    }
  };
}

/**
 * Creates dispatch functions for a Voidsync store.
 */
function createDispatchFunctions<
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TActions extends Record<string, AnyAction>
>(store: VoidsyncStore<TSchema, TYdoc, TActions>) {
  // Execute an action with the given params
  const executeAction = (action: AnyAction, params: unknown) => {
    const ctx: ActionContext<TSchema, TYdoc, typeof params, TActions> = {
      doc: store.doc,
      awareness: store.awareness,
      getState: () => store.zustand.getState(),
      setBrowser: (state) => {
        store.zustand.setState(state as Partial<TSchema['_types']['combined']>);
      },
      setAwareness: (state) => {
        for (const [key, value] of Object.entries(state)) {
          store.awareness.setLocalStateField(key, value);
        }
        // Also update zustand for local reactivity
        store.zustand.setState(state as Partial<TSchema['_types']['combined']>);
      },
      dispatch: actionDispatch,
      actions: store.actions,
      params: params as typeof params
    };
    action.fn(ctx);
  };

  // Create the action dispatch (used within action handlers)
  const actionDispatch = createActionDispatch(store, executeAction);

  // Create the hook dispatch (used from React components)
  const hookDispatch = createHookDispatch(store, executeAction);

  return { actionDispatch, hookDispatch };
}

/**
 * React hook to get a dispatch function for store actions.
 * The dispatch function is type-safe based on the store's action definitions.
 *
 * @example
 * const dispatch = useVoidsyncActions(store);
 * dispatch('addNode', { x: 100, y: 200 });
 * dispatch('selectNode', { id: '123', many: false });
 */
export const useVoidsyncActions = <
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TActions extends Record<string, AnyAction>
>(
  store: VoidsyncStore<TSchema, TYdoc, TActions>
): HookDispatchFn<TActions> => {
  const { hookDispatch } = createDispatchFunctions(store);
  return hookDispatch;
};

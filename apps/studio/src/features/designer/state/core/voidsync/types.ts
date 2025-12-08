/** biome-ignore-all lint/suspicious/noExplicitAny: generic */

import type { Schema } from 'effect';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import type { StoreApi } from 'zustand';

type Write<T, U> = Omit<T, keyof U> & U;

type StoreSubscribeWithSelector<T> = {
  subscribe: {
    (
      listener: (selectedState: T, previousSelectedState: T) => void
    ): () => void;
    <U>(
      selector: (state: T) => U,
      listener: (selectedState: U, previousSelectedState: U) => void,
      options?: {
        equalityFn?: (a: U, b: U) => boolean;
        fireImmediately?: boolean;
      }
    ): () => void;
  };
};

// ============================================================================
// Sync Field Schema Types
// ============================================================================

export const VOIDSYNC_TYPE_KEY = Symbol('voidsyncType');

export type VoidsyncTypeMarker = 'map' | 'array' | 'text';

export type VoidsyncFieldSchema<
  TMarker extends VoidsyncTypeMarker = VoidsyncTypeMarker,
  TType = unknown
> = {
  [VOIDSYNC_TYPE_KEY]: TMarker;
  _type: TType;
};

// Type to extract the inferred type from a VoidsyncFieldSchema
export type InferVoidsyncFieldType<T> = T extends { _type: infer U }
  ? U
  : never;

// Helper to infer the combined synced type from a record of field schemas
export type InferSyncedRecord<T extends Record<string, VoidsyncFieldSchema>> = {
  [K in keyof T]: InferVoidsyncFieldType<T[K]>;
};

// ============================================================================
// Schema Types
// ============================================================================

/**
 * Any Effect Schema type (used for type constraints)
 */
export type AnyEffectSchema = Schema.Schema<any, any, any>;

/**
 * Infer the Type from an Effect Schema
 */
export type InferSchemaType<T> = T extends Schema.Schema<infer A, any, any>
  ? A
  : never;

/**
 * Schema definition input for Voidsync store with three distinct state categories:
 * - awareness: Ephemeral state shared via awareness protocol (cursors, selections)
 * - browser: Local browser state, not synced (UI preferences, panel sizes)
 * - synced: Persisted state synced to the document
 */
export type VoidsyncSchemaInput<
  TAwareness extends AnyEffectSchema,
  TBrowser extends AnyEffectSchema,
  TSynced extends Record<string, VoidsyncFieldSchema>
> = {
  awareness: TAwareness;
  browser: TBrowser;
  synced: TSynced;
};

export type VoidsyncSchema<
  TAwareness extends AnyEffectSchema,
  TBrowser extends AnyEffectSchema,
  TSynced extends Record<string, VoidsyncFieldSchema>
> = {
  awareness: TAwareness;
  browser: TBrowser;
  synced: TSynced;
  _types: {
    awareness: InferSchemaType<TAwareness>;
    browser: InferSchemaType<TBrowser>;
    synced: InferSyncedRecord<TSynced>;
    combined: InferSchemaType<TAwareness> &
      InferSchemaType<TBrowser> &
      InferSyncedRecord<TSynced>;
  };
};

// ============================================================================
// Action Types
// ============================================================================

/**
 * Symbol used to identify ActionCall objects at runtime.
 */
export const ACTION_CALL_SYMBOL = Symbol('actionCall');

/**
 * Represents a type-safe action invocation created by action.call(params).
 * Used to dispatch actions with full type safety.
 * TReturn is a phantom type used for type inference only.
 */
export type ActionCall<TParams = unknown, TReturn = void> = {
  readonly [ACTION_CALL_SYMBOL]: true;
  readonly action: AnyAction;
  readonly params: TParams;
  /** Phantom type marker for return type inference */
  readonly _returnType?: TReturn;
};

/**
 * Type guard to check if a value is an ActionCall.
 */
export function isActionCall(value: unknown): value is ActionCall {
  return (
    typeof value === 'object' &&
    value !== null &&
    ACTION_CALL_SYMBOL in value &&
    value[ACTION_CALL_SYMBOL] === true
  );
}

/**
 * Type for action factory functions that take storeState and return an Action.
 */
export type ActionFactory<
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TParams,
  TReturn = void
> = (
  storeState: VoidsyncState<TSchema, TYdoc>
) => Action<TSchema, TYdoc, TParams, TReturn>;

/**
 * Dispatch function that accepts action factory functions.
 * Used within action handlers to dispatch other actions.
 * Returns the value from the action.
 *
 * @example
 * // Dispatch from within another action:
 * dispatch(unselectNode)({ id: params.id });
 *
 * // Or dispatch with void params:
 * dispatch(clearSelection)();
 *
 * // With return value:
 * const result = dispatch(calculateSomething)({ input: 42 });
 */
export type ActionDispatchFn<
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc
> = <TParams, TReturn = void>(
  actionFactory: ActionFactory<TSchema, TYdoc, TParams, TReturn>
) => (params: TParams) => TReturn;

/**
 * Legacy dispatch function for string-based action dispatch.
 * Used from React components via useVoidsyncActions hook.
 * Returns the value from the action.
 *
 * @example
 * dispatch('selectNode', { id: '123', many: false });
 * dispatch('clearSelection', {});
 *
 * // With return value:
 * const result = dispatch('calculateSomething', { input: 42 });
 */
export type HookDispatchFn<TActions extends Record<string, AnyAction>> = <
  TName extends keyof TActions
>(
  name: TName,
  params: TActions[TName] extends Action<any, any, infer P, any> ? P : never
) => TActions[TName] extends Action<any, any, any, infer R> ? R : undefined;

/**
 * Action context providing access to all state and mutation methods
 */
export type ActionContext<
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TParams,
  TActions extends Record<string, AnyAction> = Record<string, AnyAction>
> = {
  /** The document for persisted state mutations */
  doc: TYdoc;
  /** The Awareness instance for ephemeral shared state */
  awareness: Awareness;
  /** Get current combined state (awareness + browser + synced) */
  getState: () => TSchema['_types']['combined'];
  /** Set browser-only state (local, not synced) */
  setBrowser: (state: Partial<TSchema['_types']['browser']>) => void;
  /** Set awareness state (ephemeral, shared via awareness protocol) */
  setAwareness: (state: Partial<TSchema['_types']['awareness']>) => void;
  /**
   * Dispatch another action using its factory function.
   *
   * @example
   * dispatch(unselectNode)({ id: params.id });
   * dispatch(selectNode)({ id: '123', many: false });
   * dispatch(clearSelection)();
   */
  dispatch: ActionDispatchFn<TSchema, TYdoc>;
  /**
   * Access to all registered actions for advanced use cases.
   */
  actions: TActions;
  /** Action parameters passed by the caller */
  params: TParams;
};

export type ActionFn<
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TParams = any,
  TReturn = void,
  TActions extends Record<string, AnyAction> = Record<string, AnyAction>
> = (ctx: ActionContext<TSchema, TYdoc, TParams, TActions>) => TReturn;

export type Action<
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TParams = any,
  TReturn = void
> = {
  readonly fn: ActionFn<TSchema, TYdoc, TParams, TReturn, any>;
  readonly paramsSchema: AnyEffectSchema | null;
  /**
   * Create a type-safe action call for dispatch.
   *
   * @example
   * dispatch(selectNode.call({ id: '123', many: false }));
   */
  readonly call: (params: TParams) => ActionCall<TParams, TReturn>;
};

export type AnyAction = Action<any, any, any, any>;

/**
 * Extract the params type from an action.
 *
 * @example
 * type SelectNodeParams = ActionParams<typeof selectNode>;
 * // { id: string, many: boolean }
 */
export type ActionParams<T> = T extends Action<any, any, infer P, any>
  ? P
  : never;

/**
 * Extract the return type from an action.
 *
 * @example
 * type CalculateResult = ActionReturn<typeof calculateSomething>;
 * // number
 */
export type ActionReturn<T> = T extends Action<any, any, any, infer R>
  ? R
  : undefined;

// ============================================================================
// Sync Types
// ============================================================================

export type SyncFromDoc<TSyncedState, TYdoc extends Y.Doc> = (
  doc: TYdoc,
  set: (state: Partial<TSyncedState>) => void
) => void;

// ============================================================================
// State & Store Types
// ============================================================================

export type VoidsyncState<
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc
> = {
  zustand: Write<
    StoreApi<TSchema['_types']['combined']>,
    StoreSubscribeWithSelector<TSchema['_types']['combined']>
  >;
  doc: TYdoc;
  awareness: Awareness;
  schema: TSchema;
  syncFromDoc: SyncFromDoc<TSchema['_types']['synced'], TYdoc>;
  /**
   * Create an action with an Effect Schema for params.
   * Types are inferred from the schema.
   * Actions can optionally return a value.
   *
   * @example
   * const addNode = storeState.action(
   *   Schema.Struct({ x: Schema.Number, y: Schema.Number }),
   *   ({ doc, params }) => {
   *     doc.getMap('nodes').set(id, params);
   *   }
   * );
   *
   * // Action with return value:
   * const getNodeCount = storeState.action(
   *   ({ getState }) => {
   *     return Object.keys(getState().nodes).length;
   *   }
   * );
   */
  action: {
    // With params schema and return type
    <TParamsSchema extends AnyEffectSchema, TReturn = void>(
      paramsSchema: TParamsSchema,
      fn: ActionFn<TSchema, TYdoc, InferSchemaType<TParamsSchema>, TReturn>
    ): Action<TSchema, TYdoc, InferSchemaType<TParamsSchema>, TReturn>;
    // Without params (void), with optional return type
    <TReturn = void>(
      fn: ActionFn<TSchema, TYdoc, void, TReturn>
    ): Action<TSchema, TYdoc, void, TReturn>;
  };
};

export type VoidsyncStore<
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TActions extends Record<string, AnyAction>
> = {
  zustand: Readonly<
    Write<
      StoreApi<TSchema['_types']['combined']>,
      StoreSubscribeWithSelector<TSchema['_types']['combined']>
    >
  >;
  doc: TYdoc;
  awareness: Awareness;
  schema: TSchema;
  actions: TActions;
  /** The local client's unique ID */
  clientId: number;
  /** Reference to the underlying state for action factory invocation */
  storeState: VoidsyncState<TSchema, TYdoc>;
};

// ============================================================================
// Awareness Types
// ============================================================================

/**
 * Represents all users' awareness states as a map from clientId to state
 */
export type AwarenessStates<TAwareness> = Map<number, TAwareness>;

// ============================================================================
// Initial State Input Type
// ============================================================================

export type InitialStateInput<TSchema extends VoidsyncSchema<any, any, any>> = {
  awareness: TSchema['_types']['awareness'];
  browser: TSchema['_types']['browser'];
};

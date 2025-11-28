/** biome-ignore-all lint/suspicious/noExplicitAny: generic */
import type * as Y from 'yjs';
import type {
  AnyAction,
  VoidsyncSchema,
  VoidsyncState,
  VoidsyncStore
} from './types';

/**
 * Creates the final Voidsync store by combining state with actions.
 * Sets up sync subscriptions between the document and zustand store.
 *
 * @example
 * const store = createVoidsyncStore(storeState, {
 *   addNode: addNodeAction,
 *   deleteNode: deleteNodeAction
 * });
 */
export function createVoidsyncStore<
  TSchema extends VoidsyncSchema<any, any, any>,
  TYdoc extends Y.Doc,
  TActions extends Record<string, AnyAction>
>(
  storeState: VoidsyncState<TSchema, TYdoc>,
  actions: TActions
): VoidsyncStore<TSchema, TYdoc, TActions> {
  const { zustand, doc, awareness, schema, syncFromDoc } = storeState;

  // Initial sync from document to zustand
  syncFromDoc(doc, (partial) => zustand.setState(partial));

  // Subscribe to document changes and sync to zustand
  doc.on('update', () => {
    syncFromDoc(doc, (partial) => zustand.setState(partial));
  });

  // Subscribe to awareness changes and sync to zustand
  awareness.on('change', () => {
    const localState = awareness.getLocalState();
    if (localState) {
      zustand.setState(localState as Partial<TSchema['_types']['combined']>);
    }
  });

  return {
    zustand,
    doc,
    awareness,
    schema,
    actions,
    clientId: awareness.clientID
  };
}

'use client';

import { createId } from '@paralleldrive/cuid2';
import { IndexGenerator } from 'fractional-indexing-jittered';
import { createContext, useContext, useRef } from 'react';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { INIT_SCREEN_DATA, SHOW_GRID } from '../constants';
import { createDesignerActions } from './actions';
import {
  createVoidsyncState,
  createVoidsyncStore,
  useVoidsyncActions,
  useVoidsyncAwareness,
  useVoidsyncSelect
} from './core/voidsync';
import {
  type DesignerSchema,
  designerSchema,
  rootNodeSchema,
  screenNodeSchema
} from './schema';

// ============================================================================
// Store Factory
// ============================================================================

function createDesignerStore(doc: Y.Doc, awareness: Awareness) {
  // Create the store state with initial values
  const storeState = createVoidsyncState(designerSchema)(
    {
      awareness: {
        cursor: null,
        user: {
          name: `User ${Math.floor(Math.random() * 1000)}`,
          color: `#${Math.floor(Math.random() * 16_777_215)
            .toString(16)
            .padStart(6, '0')}`
        },
        selectedNodeIds: []
      },
      browser: {
        debug: {
          showGrid: SHOW_GRID
        },
        viewport: {
          panels: {
            top: { height: 0 },
            bottom: { height: 0 },
            left: { width: 0 },
            right: { width: 0 }
          }
        }
      }
    },
    doc,
    awareness
  );

  // Create all actions from modular action files
  const actions = createDesignerActions(storeState);

  // Create final store with actions
  return createVoidsyncStore(storeState, actions);
}

type DesignerStoreType = ReturnType<typeof createDesignerStore>;

// ============================================================================
// React Context
// ============================================================================

const StoreContext = createContext<DesignerStoreType | null>(null);

interface DesignerStoreProviderProps {
  children: React.ReactNode;
  ydoc?: Y.Doc;
  awareness?: Awareness;
}

export function DesignerStoreProvider({
  children,
  ydoc,
  awareness: externalAwareness
}: DesignerStoreProviderProps) {
  const storeRef = useRef<DesignerStoreType | null>(null);

  function createNewYDoc() {
    const generator = new IndexGenerator([]);

    const doc = new Y.Doc();
    const nodesMap = doc.getMap('nodes');
    const rootNodeData = rootNodeSchema.parse({
      id: 'root',
      type: 'root'
    });

    const initScreenData = screenNodeSchema.parse({
      ...INIT_SCREEN_DATA,
      id: createId(),
      type: 'screen',
      parent: {
        id: rootNodeData.id,
        index: generator.keyStart()
      }
    });

    nodesMap.set(rootNodeData.id, rootNodeData);
    nodesMap.set(initScreenData.id, initScreenData);

    return doc;
  }

  if (storeRef.current === null) {
    const doc = ydoc ?? createNewYDoc();
    const awareness = externalAwareness ?? new Awareness(doc);
    storeRef.current = createDesignerStore(doc, awareness);
  }

  return (
    <StoreContext.Provider value={storeRef.current}>
      {children}
    </StoreContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

function useDesignerStore() {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('Missing DesignerStoreProvider');
  }
  return store;
}

/**
 * Select state from the designer store reactively.
 * Re-renders when the selected state changes.
 *
 * @example
 * const nodes = useDesignerSelect((state) => state.nodes);
 * const showGrid = useDesignerSelect((state) => state.debug.showGrid);
 */
export function useDesignerSelect<TResult>(
  selector: (state: DesignerSchema['_types']['combined']) => TResult
): TResult {
  const store = useDesignerStore();
  return useVoidsyncSelect(store, selector);
}

/**
 * Get a dispatch function to call store actions.
 *
 * @example
 * const dispatch = useDesignerActions();
 * dispatch('addNode', { id: '123', x: 0, y: 0, width: 100, height: 100 });
 * dispatch('toggleShowGrid');
 */
export function useDesignerActions() {
  const store = useDesignerStore();
  return useVoidsyncActions(store);
}

/**
 * Get all users' awareness states (for rendering remote cursors, presence, etc.)
 *
 * @example
 * const awarenessStates = useDesignerAwareness();
 * const otherUsers = Array.from(awarenessStates.entries())
 *   .filter(([clientId]) => clientId !== store.clientId);
 */
export function useDesignerAwareness() {
  const store = useDesignerStore();
  return useVoidsyncAwareness(store);
}

/**
 * Get the local client's unique ID.
 */
export function useDesignerClientId() {
  const store = useDesignerStore();
  return store.clientId;
}

/**
 * Get the raw Yjs document for advanced use cases.
 */
export function useDesignerDoc() {
  const store = useDesignerStore();
  return store.doc;
}

// ============================================================================
// Legacy Compatibility Aliases
// ============================================================================

/** @deprecated Use useDesignerSelect instead */
export const useDesignerStoreInContext = useDesignerSelect;

/** @deprecated Use useDesignerSelect instead */
export const useDesignFileSelect = useDesignerSelect;

/** @deprecated Use useDesignerActions instead */
export const useDesignFileActions = useDesignerActions;

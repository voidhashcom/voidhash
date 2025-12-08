'use client';

import {
  PaywallDocumentEditor,
  ScreenNode,
  type ScreenNodeData,
  YjsStorage
} from '@voidhash/dff';
import { IndexGenerator } from 'fractional-indexing-jittered';
import { createContext, useContext, useMemo, useRef } from 'react';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { INIT_SCREEN_DATA, SHOW_GRID } from '../constants';
import { createDesignerActions, type DesignerActions } from './actions';
import {
  createVoidsyncState,
  createVoidsyncStore,
  type HookDispatchFn,
  useVoidsyncActions,
  useVoidsyncAwareness,
  useVoidsyncSelect
} from './core/voidsync';
import { useVoidsyncSubscribe } from './core/voidsync/hooks';
import { type DesignerSchema, designerSchema } from './schema';
import { createNodeId } from './utils/id';

// ============================================================================
// Store Factory
// ============================================================================

function createDesignerStoreState(doc: Y.Doc, awareness: Awareness) {
  // Create the store state with initial values
  return createVoidsyncState(designerSchema)(
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
        highlightedNodeId: null,
        tools: {
          activeTool: 'cursor'
        },
        canvas: {
          scale: 1,
          x: 0,
          y: 0,
          boundingBoxes: {}
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
}

function createDesignerStore(
  storeState: ReturnType<typeof createDesignerStoreState>,
  actions: ReturnType<typeof createDesignerActions>
) {
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

function createNewYDoc() {
  const generator = new IndexGenerator([]);
  const doc = new Y.Doc();

  // Create editor with YjsStorage - all mutations go through this
  const yjsStorage = new YjsStorage(doc);
  const editor = new PaywallDocumentEditor({ primaryStorage: yjsStorage });
  editor.initialize();

  // Create root node through editor
  editor.createRootNode('root');

  // Create initial screen using v2 node class for defaults
  const screenNodeClass = new ScreenNode();
  const screenDefaults = screenNodeClass.getDefaults();

  const initScreenData: ScreenNodeData = {
    ...screenDefaults,
    ...INIT_SCREEN_DATA,
    id: createNodeId(),
    name: 'Screen 1',
    parent: {
      id: 'root',
      index: generator.keyStart()
    }
  };

  // All writes go through editor (validated)
  editor.setNode(initScreenData as unknown as Record<string, unknown>);

  return doc;
}

export function DesignerStoreProvider({
  children,
  ydoc,
  awareness: externalAwareness
}: DesignerStoreProviderProps) {
  const storeRef = useRef<DesignerStoreType | null>(null);

  if (storeRef.current === null) {
    const doc = ydoc ?? createNewYDoc();
    const awareness = externalAwareness ?? new Awareness(doc);
    const storeState = createDesignerStoreState(doc, awareness);
    const actions = createDesignerActions(storeState);
    storeRef.current = createDesignerStore(storeState, actions);
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

export function useDesignerStore() {
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

export function useDesignerSubscribe<TResult>(
  selector: (state: DesignerSchema['_types']['combined']) => TResult,
  callback: (state: TResult) => void
) {
  const store = useDesignerStore();
  return useVoidsyncSubscribe(store, selector, callback);
}

/**
 * Get a dispatch function to call store actions.
 * Returns a fully type-safe dispatch function based on the registered actions.
 *
 * @example
 * const dispatch = useDesignerActions();
 * dispatch('setActiveTool', { tool: 'cursor' });
 * dispatch('updateScreenNode', { id: '123', paddingTop: 10 });
 */
export function useDesignerActions(): HookDispatchFn<DesignerActions> {
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

/**
 * Get a PaywallDocumentEditor populated with the current nodes from Zustand state.
 * Provides typed accessors for reading node data in React components.
 * Re-renders when nodes change.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const document = useDesignerDocument();
 *
 *   // Use typed accessors
 *   const screen = document.getScreen('screen-1');
 *   const flex = document.getFlex('flex-1');
 *
 *   // Or iterate over all nodes
 *   const allNodes = document.getAllNodes();
 * }
 * ```
 */
export function useDesignerDocument(): PaywallDocumentEditor {
  const nodes = useDesignerSelect((state) => state.nodes);

  return useMemo(
    () => PaywallDocumentEditor.fromNodes(nodes as Record<string, unknown>),
    [nodes]
  );
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

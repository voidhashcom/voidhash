"use client";

import {
	PaywallDocumentEditor,
	ScreenNode,
	type ScreenNodeData,
	YjsStorage,
} from "@voidhash/dff";
import { IndexGenerator } from "fractional-indexing-jittered";
import { createContext, useContext, useMemo, useRef } from "react";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import {
	createVoidsyncState,
	createVoidsyncStore,
	type HookDispatchFn,
	useVoidsyncActions,
	useVoidsyncAwareness,
	useVoidsyncSelect,
} from "../../../designer/voidsync";
import { useVoidsyncSubscribe } from "../../../designer/voidsync/hooks";
import { INIT_SCREEN_DATA, SHOW_GRID } from "../constants";
import {
	createDesignerActions as createPaywallDesignerActions,
	type DesignerActions,
} from "./actions";
import { type DesignerSchema, designerSchema } from "./schema";
import { createNodeId } from "./utils/id";

// ============================================================================
// Store Factory
// ============================================================================

function createPaywallDesignerStoreState(doc: Y.Doc, awareness: Awareness) {
	// Create the store state with initial values
	return createVoidsyncState(designerSchema)(
		{
			awareness: {
				cursor: null,
				user: {
					name: `User ${Math.floor(Math.random() * 1000)}`,
					color: `#${Math.floor(Math.random() * 16_777_215)
						.toString(16)
						.padStart(6, "0")}`,
				},
				selectedNodeIds: [],
			},
			browser: {
				debug: {
					showGrid: SHOW_GRID,
				},
				highlightedNodeId: null,
				tools: {
					activeTool: "cursor",
				},
				canvas: {
					scale: 1,
					x: 0,
					y: 0,
					boundingBoxes: {},
				},
				viewport: {
					panels: {
						top: { height: 0 },
						bottom: { height: 0 },
						left: { width: 0 },
						right: { width: 0 },
					},
				},
			},
		},
		doc,
		awareness,
	);
}

function createPaywallDesignerStore(
	storeState: ReturnType<typeof createPaywallDesignerStoreState>,
	actions: ReturnType<typeof createPaywallDesignerActions>,
) {
	// Create final store with actions
	return createVoidsyncStore(storeState, actions);
}

type PaywallDesignerStoreType = ReturnType<typeof createPaywallDesignerStore>;

// ============================================================================
// React Context
// ============================================================================

const PaywallStoreContext = createContext<PaywallDesignerStoreType | null>(
	null,
);

interface PaywallDesignerStoreProviderProps {
	children: React.ReactNode;
	ydoc?: Y.Doc;
	awareness?: Awareness;
}

function createNewPaywallYDoc() {
	const generator = new IndexGenerator([]);
	const doc = new Y.Doc();

	// Create editor with YjsStorage - all mutations go through this
	const yjsStorage = new YjsStorage(doc);
	const editor = new PaywallDocumentEditor({ primaryStorage: yjsStorage });
	editor.initialize();

	// Create root node through editor
	editor.createRootNode("root");

	// Create initial screen using v2 node class for defaults
	const screenNodeClass = new ScreenNode();
	const screenDefaults = screenNodeClass.getDefaults();

	const initScreenData: ScreenNodeData = {
		...screenDefaults,
		...INIT_SCREEN_DATA,
		id: createNodeId(),
		name: "Screen 1",
		parent: {
			id: "root",
			index: generator.keyStart(),
		},
	};

	// All writes go through editor (validated)
	editor.setNode(initScreenData as unknown as Record<string, unknown>);

	return doc;
}

export function PaywallDesignerStoreProvider({
	children,
	ydoc,
	awareness: externalAwareness,
}: PaywallDesignerStoreProviderProps) {
	const storeRef = useRef<PaywallDesignerStoreType | null>(null);

	if (storeRef.current === null) {
		const doc = ydoc ?? createNewPaywallYDoc();
		const awareness = externalAwareness ?? new Awareness(doc);
		const storeState = createPaywallDesignerStoreState(doc, awareness);
		const actions = createPaywallDesignerActions(storeState);
		storeRef.current = createPaywallDesignerStore(storeState, actions);
	}

	return (
		<PaywallStoreContext.Provider value={storeRef.current}>
			{children}
		</PaywallStoreContext.Provider>
	);
}

// ============================================================================
// Hooks
// ============================================================================

export function usePaywallDesignerStore() {
	const store = useContext(PaywallStoreContext);
	if (!store) {
		throw new Error("Missing DesignerStoreProvider");
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
export function usePaywallDesignerSelect<TResult>(
	selector: (state: DesignerSchema["_types"]["combined"]) => TResult,
): TResult {
	const store = usePaywallDesignerStore();
	return useVoidsyncSelect(store, selector);
}

export function usePaywallDesignerSubscribe<TResult>(
	selector: (state: DesignerSchema["_types"]["combined"]) => TResult,
	callback: (state: TResult) => void,
) {
	const store = usePaywallDesignerStore();
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
export function usePaywallDesignerActions(): HookDispatchFn<DesignerActions> {
	const store = usePaywallDesignerStore();
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
export function usePaywallDesignerAwareness() {
	const store = usePaywallDesignerStore();
	return useVoidsyncAwareness(store);
}

/**
 * Get the local client's unique ID.
 */
export function usePaywallDesignerClientId() {
	const store = usePaywallDesignerStore();
	return store.clientId;
}

/**
 * Get the raw Yjs document for advanced use cases.
 */
export function usePaywallDesignerDoc() {
	const store = usePaywallDesignerStore();
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
export function usePaywallDesignerDocument(): PaywallDocumentEditor {
	const nodes = usePaywallDesignerSelect((state) => state.nodes);

	return useMemo(
		() => PaywallDocumentEditor.fromNodes(nodes as Record<string, unknown>),
		[nodes],
	);
}

// ============================================================================
// Legacy Compatibility Aliases
// ============================================================================

/** @deprecated Use useDesignerSelect instead */
export const useDesignerStoreInContext = usePaywallDesignerSelect;

/** @deprecated Use useDesignerSelect instead */
export const useDesignFileSelect = usePaywallDesignerSelect;

/** @deprecated Use useDesignerActions instead */
export const useDesignFileActions = usePaywallDesignerActions;

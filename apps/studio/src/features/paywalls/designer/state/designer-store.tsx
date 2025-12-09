"use client";

import {
	createEditor,
	createYjsStorage,
	type Editor,
	getDefaults,
	paywallDocument,
	type ScreenNodeData,
	screenNode,
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
	const storage = createYjsStorage(doc, paywallDocument);
	const editor = createEditor(paywallDocument, { storage });
	editor.initialize();

	// Create root node through editor
	editor.nodes.create("root", {
		id: "root",
	});

	// Get screen defaults from schema
	const screenDefaults = getDefaults(screenNode) as Partial<ScreenNodeData>;

	const initScreenData: ScreenNodeData = {
		...screenDefaults,
		...INIT_SCREEN_DATA,
		id: createNodeId(),
		name: "Screen 1",
		type: "screen",
		parent: {
			id: "root",
			index: generator.keyStart(),
		},
	} as ScreenNodeData;

	// Create screen node through editor (validated)
	editor.nodes.create("screen", initScreenData);

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
 * Get an Editor populated with the current nodes from Zustand state.
 * Provides typed accessors for reading node data in React components.
 * Re-renders when nodes change.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const document = useDesignerDocument();
 *
 *   // Use typed accessors
 *   const screen = document.nodes.get('screen-1');
 *   const flex = document.nodes.get('flex-1');
 * }
 * ```
 */
export function usePaywallDesignerDocument(): Editor<typeof paywallDocument> {
	const nodes = usePaywallDesignerSelect((state) => state.nodes);
	const doc = usePaywallDesignerDoc();

	return useMemo(() => {
		const storage = createYjsStorage(doc, paywallDocument);
		return createEditor(paywallDocument, { storage, initialNodes: nodes });
	}, [doc, nodes]);
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

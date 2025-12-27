"use client";

import {
	ClientDocument,
	type Presence,
	WebSocketTransport,
} from "@voidhash/mimic/client";
import { mimic } from "@voidhash/mimic-react/zustand";
import { useCommander } from "@voidhash/mimic-react/zustand-commander";
import {
	PaywallDesignerDocument,
	PresenceSchema,
} from "@voidhash/mimic-schema";
import { createContext, useContext, useRef } from "react";
import { create } from "zustand";
import { SHOW_GRID } from "../constants";
import { commander } from "./designer-commander";

// ============================================================================
// Store Factory
// ============================================================================

export const createPaywallDesignerDocument = (
	documentId: string,
	initialPresence?: Presence.Infer<typeof PresenceSchema>,
) =>
	ClientDocument.make({
		debug: true,
		schema: PaywallDesignerDocument,
		presence: PresenceSchema,
		transport: WebSocketTransport.make({
			url: "ws://localhost:5001/mimic/paywall-designer",
			documentId,
		}),
		initialPresence,
	});

function createPaywallDesignerStore(options: { name: string; color: string }) {
	// Create final store with actions
	return create(
		commander.middleware(
			mimic(
				createPaywallDesignerDocument("1", {
					cursor: null,
					user: { name: options.name, color: options.color },
					selectedNodeIds: [],
				}),
				() => ({
					// Local browser state
					debug: {
						showGrid: SHOW_GRID,
					},
					highlightedNodeId: null,
					textEditingNodeId: null,
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
				}),
			),
		),
	);
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
}

// function createNewPaywallYDoc() {
//   const generator = new IndexGenerator([]);
//   const doc = new Y.Doc();

//   // Create editor with YjsStorage - all mutations go through this
//   const storage = createYjsStorage(doc, paywallDocument);
//   const editor = createEditor(paywallDocument, { storage });
//   editor.initialize();

//   // Create root node through editor
//   editor.nodes.create('root', {
//     id: 'root'
//   });

//   // Get screen defaults from schema
//   const screenDefaults = getDefaults(screenNode) as Partial<ScreenNodeData>;

//   const initScreenData: ScreenNodeData = {
//     ...screenDefaults,
//     ...INIT_SCREEN_DATA,
//     id: createNodeId(),
//     name: 'Screen 1',
//     type: 'screen',
//     parent: {
//       id: 'root',
//       index: generator.keyStart()
//     }
//   } as ScreenNodeData;

//   // Create screen node through editor (validated)
//   editor.nodes.create('screen', initScreenData);

//   return doc;
// }

export function PaywallDesignerStoreProvider({
	children,
}: PaywallDesignerStoreProviderProps) {
	const storeRef = useRef<PaywallDesignerStoreType | null>(null);

	if (storeRef.current === null) {
		// const storeState = createPaywallDesignerStoreState(doc, awareness);
		// const actions = createPaywallDesignerActions(storeState);
		storeRef.current = createPaywallDesignerStore({
			name: `User ${Math.floor(Math.random() * 1000)}`,
			color: `#${Math.floor(Math.random() * 16_777_215)
				.toString(16)
				.padStart(6, "0")}`,
		});
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
 * Get a dispatch function to call store commands.
 * Returns a fully type-safe dispatch function using the Commander pattern.
 *
 * @example
 * const dispatch = usePaywallDesignerActions();
 * dispatch(setActiveTool)({ tool: 'cursor' });
 * dispatch(updateScreenNode)({ id: '123', paddingTop: 10 });
 */
export function usePaywallDesignerActions() {
	const store = usePaywallDesignerStore();
	return useCommander(store);
}

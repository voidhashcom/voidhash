/** biome-ignore-all lint/suspicious/noExplicitAny: generic action types require any */

/**
 * Node action helpers for simplified creation and update of nodes.
 * Built on top of storeState.action for type-safe node operations.
 * All mutations go through v3 Editor with YjsStorage for validation.
 */

import {
	createEditor,
	createYjsStorage,
	type FlexNodeData,
	paywallDocument,
	type ScreenNodeData,
	type TextNodeData,
} from "@voidhash/dff";
import { IndexGenerator } from "fractional-indexing-jittered";
import type * as Y from "yjs";
import type {
	Action,
	ActionDispatchFn,
	AnyEffectSchema,
	VoidsyncSchema,
	VoidsyncState,
} from "../../../../../designer/voidsync";
import { createNodeId } from "../../utils/id";
import { getNodesByParentId } from "../../utils/nodes";

/**
 * Creates a v3 Editor with YjsStorage for the given Y.Doc.
 * Used by actions to perform validated mutations.
 */
function createEditorForDoc(doc: Y.Doc) {
	const storage = createYjsStorage(doc, paywallDocument);
	return createEditor(paywallDocument, { storage });
}

// ============================================================================
// Types
// ============================================================================

/**
 * Supported node types that can be created/updated via actions.
 */
type CreatableNodeType = "flex" | "screen" | "text";

/**
 * Map of node type to its data type.
 */
type NodeDataMap = {
	flex: FlexNodeData;
	screen: ScreenNodeData;
	text: TextNodeData;
};

/**
 * Deep partial type that makes all nested properties optional.
 */
type DeepPartial<T> = T extends object
	? { [P in keyof T]?: DeepPartial<T[P]> }
	: T;

/**
 * Create node action params type.
 * Uses DeepPartial to allow partial style objects.
 */
type CreateParams<TData> = {
	parentId: string;
	initialValues?: DeepPartial<Omit<TData, "id" | "type" | "parent">>;
};

/**
 * Context passed to the `after` callback for create node actions.
 */
type CreateNodeAfterContext<
	TSchema extends VoidsyncSchema<AnyEffectSchema, AnyEffectSchema, any>,
	TYdoc extends Y.Doc,
	TData,
> = {
	/** The action parameters passed by the caller */
	params: CreateParams<TData>;
	/** Dispatch function to call other actions */
	dispatch: ActionDispatchFn<TSchema, TYdoc>;
	/** The newly created node data */
	node: TData;
};

/**
 * Context passed to the `after` callback for update node actions.
 */
type UpdateNodeAfterContext<
	TSchema extends VoidsyncSchema<AnyEffectSchema, AnyEffectSchema, any>,
	TYdoc extends Y.Doc,
	TData,
	TParams,
> = {
	/** The action parameters passed by the caller */
	params: TParams;
	/** Dispatch function to call other actions */
	dispatch: ActionDispatchFn<TSchema, TYdoc>;
	/** The updated node data */
	node: TData;
	/** The node data before the update */
	previousNode: TData;
};

/**
 * Options for createNodeAction
 */
type CreateNodeActionOptions<
	TSchema extends VoidsyncSchema<AnyEffectSchema, AnyEffectSchema, any>,
	TYdoc extends Y.Doc,
	TData,
> = {
	/** Callback executed after the node is created */
	after?: (ctx: CreateNodeAfterContext<TSchema, TYdoc, TData>) => void;
};

/**
 * Creates update params type from node data.
 * Includes id (required) and all other properties (optional).
 */
type UpdateParams<TData> = {
	id: string;
} & Partial<Omit<TData, "id" | "type" | "parent">>;

/**
 * Options for updateNodeAction
 */
type UpdateNodeActionOptions<
	TSchema extends VoidsyncSchema<AnyEffectSchema, AnyEffectSchema, any>,
	TYdoc extends Y.Doc,
	TData,
> = {
	/** Callback executed after the node is updated */
	after?: (
		ctx: UpdateNodeAfterContext<TSchema, TYdoc, TData, UpdateParams<TData>>,
	) => void;
};

// ============================================================================
// Create Node Action
// ============================================================================

/**
 * Creates a type-safe action for creating nodes of a specific type.
 * All mutations go through v3 Editor with YjsStorage for validation.
 *
 * @example
 * ```ts
 * export const createFlexNode = (storeState: DesignerStoreState) =>
 *   createNodeAction<FlexNodeData>(storeState, 'flex', {
 *     after: ({ params, dispatch, node }) => {
 *       dispatch(selectNode)({ id: node.id, many: false });
 *     }
 *   });
 * ```
 */
export function createNodeAction<TNodeType extends CreatableNodeType>(
	storeState: VoidsyncState<any, Y.Doc>,
	nodeType: TNodeType,
	options?: CreateNodeActionOptions<any, Y.Doc, NodeDataMap[TNodeType]>,
): Action<any, Y.Doc, CreateParams<NodeDataMap[TNodeType]>, void> {
	type TData = NodeDataMap[TNodeType];

	// Cast the action to accept params - we handle typing manually
	const action = storeState.action(
		({ params, getState, doc, dispatch }: any) => {
			const state = getState();
			const typedParams = params as CreateParams<TData>;

			// Verify parent exists
			const nodes = (state as { nodes?: Record<string, unknown> }).nodes;
			const parentNode = nodes?.[typedParams.parentId];
			if (!parentNode) {
				return;
			}

			// Generate ID and fractional index
			const id = createNodeId();
			const existingParentChildren = getNodesByParentId(
				nodes as Parameters<typeof getNodesByParentId>[0],
				typedParams.parentId,
			);
			const fractionalIndexes = existingParentChildren.map(
				(n) => n.parent.index,
			);
			const generator = new IndexGenerator(fractionalIndexes);
			const index = generator.keyEnd();

			// Create node using v3 editor
			const editor = createEditorForDoc(doc);
			const handle = editor.nodes.create(nodeType, {
				id,
				parent: {
					id: typedParams.parentId,
					index,
				},
				...typedParams.initialValues,
			} as any);

			const nodeData = handle.get() as TData;

			// Call after hook if provided
			if (options?.after) {
				options.after({
					params: typedParams,
					dispatch: dispatch as ActionDispatchFn<any, Y.Doc>,
					node: nodeData,
				});
			}
		},
	);
	return action as unknown as Action<
		any,
		Y.Doc,
		CreateParams<NodeDataMap[TNodeType]>,
		void
	>;
}

// ============================================================================
// Update Node Action
// ============================================================================

/**
 * Creates a type-safe action for updating nodes of a specific type.
 * All mutations go through v3 Editor with YjsStorage for validation.
 *
 * @example
 * ```ts
 * export const updateFlexNode = (storeState: DesignerStoreState) =>
 *   updateNodeAction<FlexNodeData>(storeState, 'flex');
 * ```
 */
export function updateNodeAction<TNodeType extends CreatableNodeType>(
	storeState: VoidsyncState<any, Y.Doc>,
	nodeType: TNodeType,
	options?: UpdateNodeActionOptions<any, Y.Doc, NodeDataMap[TNodeType]>,
): Action<any, Y.Doc, UpdateParams<NodeDataMap[TNodeType]>, void> {
	type TData = NodeDataMap[TNodeType];

	// Cast the action to accept params - we handle typing manually
	const action = storeState.action(
		({ params, getState, doc, dispatch }: any) => {
			const state = getState();
			const typedParams = params as UpdateParams<TData>;

			// Get existing node
			const nodes = (state as { nodes?: Record<string, any> }).nodes;
			const existingNode = nodes?.[typedParams.id] as TData | undefined;

			if (!existingNode || existingNode.type !== nodeType) {
				return;
			}

			// Build updates object (excluding undefined values)
			const updates: Record<string, unknown> = {};
			for (const key of Object.keys(typedParams)) {
				if (key !== "id") {
					const value = (typedParams as Record<string, unknown>)[key];
					if (value !== undefined) {
						updates[key] = value;
					}
				}
			}

			// Merge with existing node
			const updatedNode = {
				...existingNode,
				...updates,
				id: existingNode.id,
				type: existingNode.type,
			} as TData;

			// Update through v3 editor
			const editor = createEditorForDoc(doc);
			const handle = editor.nodes.get(typedParams.id);
			if (handle) {
				handle.set(updatedNode as any);
			}

			// Call after hook if provided
			if (options?.after) {
				options.after({
					params: typedParams,
					dispatch: dispatch as ActionDispatchFn<any, Y.Doc>,
					node: updatedNode,
					previousNode: existingNode,
				});
			}
		},
	);
	return action as unknown as Action<
		any,
		Y.Doc,
		UpdateParams<NodeDataMap[TNodeType]>,
		void
	>;
}

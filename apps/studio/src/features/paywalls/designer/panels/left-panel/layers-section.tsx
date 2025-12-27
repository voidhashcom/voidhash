"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	type DragMoveEvent,
	type DragOverEvent,
	type DragStartEvent,
	MeasuringStrategy,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@voidhash/ui";
import {
	ChevronDown,
	ChevronRight,
	Columns2Icon,
	Rows2Icon,
	Smartphone,
	SquareDashedIcon,
	TypeIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";
import { useShallow } from "zustand/react/shallow";
import { moveNode, selectNode, unselectNode } from "../../state/actions";
import {
	usePaywallDesignerActions,
	usePaywallDesignerStore,
} from "../../state/designer-store";
import type { NodeData } from "../../state/schema";
import { createTree } from "../../state/utils/nodes";

// ============================================================================
// Types
// ============================================================================

type TreeNode = NodeData & {
	children: TreeNode[];
};

interface FlattenedNode {
	id: string;
	node: TreeNode;
	depth: number;
	parentId: string | null;
	index: number;
	canHaveChildren: boolean;
}

interface Projection {
	depth: number;
	parentId: string | null;
	overId: string;
	isAbove: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const INDENTATION_WIDTH = 16;

const ALLOWED_CHILDREN: Record<string, string[]> = {
	root: ["screen"],
	screen: ["flex", "text"],
	flex: ["flex", "text"],
	text: [],
};

function canBeChildOf(childType: string, parentType: string): boolean {
	return ALLOWED_CHILDREN[parentType]?.includes(childType) ?? false;
}

const typeIcons = {
	screen: Smartphone,
	text: TypeIcon,
	row: Columns2Icon,
	column: Rows2Icon,
	flex: SquareDashedIcon,
	root: null,
} as const;

const measuring = {
	droppable: {
		strategy: MeasuringStrategy.Always,
	},
};

// ============================================================================
// Utility Functions
// ============================================================================

function flattenTree(
	node: TreeNode,
	expandedLayers: Set<string>,
	depth = 0,
	parentId: string | null = null,
	result: FlattenedNode[] = [],
): FlattenedNode[] {
	if (node.type === "root") {
		for (const child of node.children) {
			flattenTree(child, expandedLayers, depth, node.id, result);
		}
		return result;
	}

	const canHaveChildren = node.type === "screen" || node.type === "flex";

	result.push({
		id: node.id,
		node,
		depth,
		parentId,
		index: result.length,
		canHaveChildren,
	});

	const isExpanded = expandedLayers.has(node.id);
	if (isExpanded) {
		for (const child of node.children) {
			flattenTree(child, expandedLayers, depth + 1, node.id, result);
		}
	}

	return result;
}

function removeChildrenOf(
	items: FlattenedNode[],
	ids: string[],
): FlattenedNode[] {
	const excludeParentIds = new Set(ids);
	const result: FlattenedNode[] = [];

	for (const item of items) {
		if (excludeParentIds.has(item.id)) {
			result.push(item);
			continue;
		}

		let isChildOfExcluded = false;
		let currentParentId = item.parentId;

		while (currentParentId) {
			if (excludeParentIds.has(currentParentId)) {
				isChildOfExcluded = true;
				break;
			}
			const parent = items.find((i) => i.id === currentParentId);
			currentParentId = parent?.parentId ?? null;
		}

		if (!isChildOfExcluded) {
			result.push(item);
		}
	}

	return result;
}

function getProjection(
	items: FlattenedNode[],
	activeId: string,
	overId: string,
	dragOffset: number,
	indentationWidth: number,
	cursorY: number,
	overItemHeight: number,
): Projection | null {
	const overItemIndex = items.findIndex(({ id }) => id === overId);
	const activeItemIndex = items.findIndex(({ id }) => id === activeId);
	const activeItem = items[activeItemIndex];

	if (!activeItem) {
		return null;
	}

	// Determine if cursor is in top or bottom half
	const isAbove = cursorY < overItemHeight / 2;

	// Calculate target index based on above/below
	const targetIndex = isAbove ? overItemIndex : overItemIndex + 1;

	// Calculate depth from horizontal drag offset
	const dragDepth = Math.round(dragOffset / indentationWidth);
	const projectedDepth = activeItem.depth + dragDepth;

	// Get items before and after target position
	const previousItem = targetIndex > 0 ? items[targetIndex - 1] : undefined;
	const nextItem = targetIndex < items.length ? items[targetIndex] : undefined;

	const maxDepth = getMaxDepth(previousItem);
	const minDepth = getMinDepth(nextItem);

	let depth = projectedDepth;
	if (projectedDepth >= maxDepth) {
		depth = maxDepth;
	} else if (projectedDepth < minDepth) {
		depth = minDepth;
	}

	// Find valid parent that can accept the dragged node type
	const activeNodeType = activeItem.node.type;
	let parentId = getParentId(previousItem, depth, items);

	// Prevent dropping a node inside itself
	if (parentId === activeId) {
		// Try to use the parent's parent instead
		const parentItem = items.find((item) => item.id === parentId);
		if (parentItem) {
			parentId = parentItem.parentId;
			depth = parentItem.depth;
		} else {
			return null;
		}
	}

	// Validate parent-child relationship
	if (parentId === "root") {
		// Root can only contain screens
		if (!canBeChildOf(activeNodeType, "root")) {
			return null;
		}
	} else {
		// Find the parent node and validate
		const parentItem = items.find((item) => item.id === parentId);
		if (!parentItem) {
			return null;
		}
		if (!canBeChildOf(activeNodeType, parentItem.node.type)) {
			// Try to find a valid ancestor
			let currentParentId = parentItem.parentId;
			while (currentParentId) {
				if (currentParentId === "root") {
					if (canBeChildOf(activeNodeType, "root")) {
						parentId = "root";
						depth = 0;
						break;
					}
					return null;
				}
				const ancestorItem = items.find((item) => item.id === currentParentId);
				if (!ancestorItem) {
					return null;
				}
				if (canBeChildOf(activeNodeType, ancestorItem.node.type)) {
					parentId = currentParentId;
					depth = ancestorItem.depth + 1;
					break;
				}
				currentParentId = ancestorItem.parentId;
			}
			if (!currentParentId && parentId !== "root") {
				return null;
			}
		}
	}

	return { depth, parentId, overId, isAbove };
}

function getMaxDepth(previousItem: FlattenedNode | undefined): number {
	if (!previousItem) {
		return 0;
	}

	// If previous item can have children, max depth is previous depth + 1
	if (previousItem.canHaveChildren) {
		return previousItem.depth + 1;
	}

	// Otherwise, max depth is the same as previous item
	return previousItem.depth;
}

function getMinDepth(nextItem: FlattenedNode | undefined): number {
	if (!nextItem) {
		return 0;
	}
	return nextItem.depth;
}

function getParentId(
	previousItem: FlattenedNode | undefined,
	depth: number,
	items: FlattenedNode[],
): string | null {
	if (!previousItem) {
		return "root";
	}

	if (depth === previousItem.depth + 1 && previousItem.canHaveChildren) {
		return previousItem.id;
	}

	if (depth === previousItem.depth) {
		return previousItem.parentId;
	}

	// Find ancestor at target depth
	let current: FlattenedNode | undefined = previousItem;
	while (current && current.depth > depth) {
		current = items.find((item) => item.id === current?.parentId);
	}

	return current?.parentId ?? "root";
}

function getSiblingAfter(
	items: FlattenedNode[],
	overId: string,
	targetParentId: string | null,
): string | null {
	const overIndex = items.findIndex((i) => i.id === overId);

	for (let i = overIndex + 1; i < items.length; i++) {
		const item = items.at(i);
		if (!item) {
			continue;
		}
		if (item.parentId === targetParentId) {
			return item.id;
		}
		// If we've gone past the depth level, stop
		const targetParent = items.find((x) => x.id === targetParentId);
		if (item.depth <= (targetParent?.depth ?? -1)) {
			break;
		}
	}

	return null;
}

function getHighlightedNodeIds(
	projectedParentId: string | null,
	tree: TreeNode,
): Set<string> {
	const highlightedIds = new Set<string>();

	if (projectedParentId === null) {
		return highlightedIds;
	}

	// Find the parent node in the tree
	function findNode(node: TreeNode, targetId: string): TreeNode | null {
		if (node.id === targetId) {
			return node;
		}
		for (const child of node.children) {
			const found = findNode(child, targetId);
			if (found) {
				return found;
			}
		}
		return null;
	}

	// If parentId is "root", highlight entire tree
	if (projectedParentId === "root") {
		function collectAllIds(node: TreeNode): void {
			if (node.type !== "root") {
				highlightedIds.add(node.id);
			}
			for (const child of node.children) {
				collectAllIds(child);
			}
		}
		collectAllIds(tree);
		return highlightedIds;
	}

	// Find the parent node and collect its subtree
	const parentNode = findNode(tree, projectedParentId);
	if (parentNode) {
		function collectSubtreeIds(node: TreeNode): void {
			highlightedIds.add(node.id);
			for (const child of node.children) {
				collectSubtreeIds(child);
			}
		}
		collectSubtreeIds(parentNode);
	}

	return highlightedIds;
}

function isDescendantOfSelected(
	item: FlattenedNode,
	flattenedItems: FlattenedNode[],
	selectedNodeIds: string[],
): boolean {
	if (selectedNodeIds.length === 0) {
		return false;
	}

	let currentParentId = item.parentId;
	while (currentParentId) {
		if (currentParentId === "root") {
			break;
		}
		if (selectedNodeIds.includes(currentParentId)) {
			return true;
		}
		const parent = flattenedItems.find((i) => i.id === currentParentId);
		if (!parent) {
			break;
		}
		currentParentId = parent.parentId;
	}

	return false;
}

// ============================================================================
// Components
// ============================================================================

const END_DROP_ZONE_ID = "__end-drop-zone__";

interface SortableTreeItemProps {
	id: string;
	node: TreeNode;
	depth: number;
	indentationWidth: number;
	projected: Projection | null;
	activeId: string | null;
	isSelected: boolean;
	onSelect: (id: string, many: boolean) => void;
	onUnselect: (id: string) => void;
	onToggle: (id: string) => void;
	isExpanded: boolean;
	hasChildren: boolean;
	isFirst: boolean;
	isLast: boolean;
	isHighlighted: boolean;
	isChildOfSelected: boolean;
}

function SortableTreeItem({
	id,
	node,
	depth,
	indentationWidth,
	projected,
	activeId,
	isSelected,
	onSelect,
	onUnselect,
	onToggle,
	isExpanded,
	hasChildren,
	isLast,
	isFirst,
	isHighlighted,
	isChildOfSelected,
}: SortableTreeItemProps) {
	const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id });

	const iconType = (() => {
		if (node.type === "flex") {
			if (!hasChildren) {
				return "flex";
			}
			return node.data.style.flexDirection === "column" ? "column" : "row";
		}
		return node.type;
	})();

	const Icon = typeIcons[iconType];
	const displayName = "name" in node.data ? node.data.name : "Unknown";

	const isActiveItem = id === activeId;
	const isDraggingSomething = activeId !== null;

	// Show drop indicator if this is the target position
	// We show indicators even when hovering over the dragged item itself
	const showIndicatorAbove =
		projected && projected.overId === id && projected.isAbove;
	const showIndicatorBelow =
		projected && projected.overId === id && !projected.isAbove;

	// Show indicator below if this is the last item and drop is at the end
	const showIndicatorAtEnd =
		isLast && projected && projected.overId === END_DROP_ZONE_ID;

	const indentStyle: React.CSSProperties = {
		paddingLeft: `${depth * indentationWidth}px`,
	};

	// Apply opacity dimming when dragging and not highlighted
	const opacityClass =
		isDraggingSomething && !isActiveItem && !isHighlighted ? "opacity-40" : "";

	const handleClick = (e: React.MouseEvent) => {
		if (isSelected && e.shiftKey) {
			onUnselect(id);
		} else {
			onSelect(id, e.shiftKey);
		}
	};

	const handleToggleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		onToggle(id);
	};

	return (
		<div
			className={cn("relative", isDragging && "opacity-40", opacityClass)}
			data-id={id}
			ref={setNodeRef}
		>
			{/* Drop indicator line - above */}
			{showIndicatorAbove && (
				<div
					className="pointer-events-none absolute right-0 left-0 z-10 h-0.5 bg-primary"
					style={{
						top: -1,
						marginLeft: `${(projected?.depth ?? depth) * indentationWidth}px`,
					}}
				/>
			)}

			{/** biome-ignore lint/a11y/noStaticElementInteractions: dnd-kit requires a div for drag handling */}
			{/** biome-ignore lint/a11y/useKeyWithClickEvents: dnd-kit handles keyboard interactions via attributes */}
			{/** biome-ignore lint/nursery/noNoninteractiveElementInteractions: dnd-kit handles interactions via attributes */}
			<div
				className={cn(
					"flex h-7 items-center gap-1 rounded-sm px-1 hover:bg-accent/50",
					isSelected && "bg-accent text-accent-foreground hover:bg-accent",
					isSelected && hasChildren && isExpanded && "rounded-b-none",
					!isLast && "rounded-b-none",
					isChildOfSelected && !isFirst && "rounded-t-none",
					isChildOfSelected &&
						!isSelected &&
						"bg-accent/40 text-accent-foreground/80",
				)}
				onClick={handleClick}
				style={indentStyle}
				{...attributes}
				{...listeners}
			>
				{/* Expand/Collapse Toggle */}
				<button
					className="flex shrink-0 items-center rounded-sm p-0.5 hover:bg-accent"
					onClick={handleToggleClick}
					type="button"
				>
					{hasChildren ? (
						isExpanded ? (
							<span className="flex size-3 items-center justify-center [&_svg]:size-3">
								<ChevronDown className="text-muted-foreground" />
							</span>
						) : (
							<span className="flex size-3 items-center justify-center [&_svg]:size-3">
								<ChevronRight className="text-muted-foreground" />
							</span>
						)
					) : (
						<span className="size-3" />
					)}
				</button>

				{/* Node Content */}
				<div className="flex flex-1 items-center gap-1.5 overflow-hidden">
					{Icon && (
						<span className="flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5">
							<Icon className="text-muted-foreground" />
						</span>
					)}
					<span className="truncate font-medium text-xs">{displayName}</span>
				</div>
			</div>

			{/* Drop indicator line - below */}
			{showIndicatorBelow && (
				<div
					className="pointer-events-none absolute right-0 left-0 z-10 h-0.5 bg-primary"
					style={{
						bottom: -1,
						marginLeft: `${(projected?.depth ?? depth) * indentationWidth}px`,
					}}
				/>
			)}

			{/* Drop indicator line - at end */}
			{showIndicatorAtEnd && (
				<div
					className="pointer-events-none absolute right-0 left-0 z-10 h-0.5 bg-primary"
					style={{
						bottom: -1,
						marginLeft: `${(projected?.depth ?? 0) * indentationWidth}px`,
					}}
				/>
			)}
		</div>
	);
}

// ============================================================================
// Expanded Layers Logic
// ============================================================================

const getExpandedLayersBySelectedNodes = (
	tree: TreeNode,
	selectedNodeIds: string[],
): Set<string> => {
	const reduceExpandedNodeIdsToSet = (
		node: TreeNode,
		selectedIds: string[],
	): Set<string> => {
		if (node.children.length === 0) {
			if (selectedIds.includes(node.id)) {
				return new Set([node.id]);
			}
			return new Set([]);
		}

		const childrenExpandedIds = node.children.flatMap((child) =>
			Array.from(reduceExpandedNodeIdsToSet(child, selectedIds)),
		);

		return new Set([
			...childrenExpandedIds,
			...(childrenExpandedIds.length > 0 ? [node.id] : []),
		]);
	};

	return tree ? reduceExpandedNodeIdsToSet(tree, selectedNodeIds) : new Set([]);
};

// ============================================================================
// Main Component
// ============================================================================

export function LayersSection() {
	const store = usePaywallDesignerStore();
	const selectedNodeIds = useStore(store, (state) => state.selectedNodeIds);
	const nodes = useStore(store, (state) => state.nodes);
	const dispatch = usePaywallDesignerActions();

	const [activeId, setActiveId] = useState<string | null>(null);
	const [overId, setOverId] = useState<string | null>(null);
	const [offsetLeft, setOffsetLeft] = useState(0);
	const [cursorY, setCursorY] = useState(0);
	const [overItemHeight, setOverItemHeight] = useState(28); // Default height (h-7 = 28px)
	const [hoverExpandTimer, setHoverExpandTimer] = useState<{
		nodeId: string;
		timeoutId: ReturnType<typeof setTimeout>;
	} | null>(null);
	const [expandedLayers, setExpandedLayers] = useState<Set<string>>(
		new Set([]),
	);
	const mouseYRef = useRef<number>(0);
	const lastValidProjectionRef = useRef<Projection | null>(null);
	const lastValidOverIdRef = useRef<string | null>(null);
	const overIdRef = useRef<string | null>(null);
	const cursorYRef = useRef<number>(0);
	const overItemHeightRef = useRef<number>(28);
	const lastIsAboveRef = useRef<boolean>(true);

	// Keep ref in sync with state
	useEffect(() => {
		overIdRef.current = overId;
	}, [overId]);

	// Track mouse position during drag
	useEffect(() => {
		if (!activeId) {
			return;
		}

		const handleMouseMove = (e: MouseEvent) => {
			mouseYRef.current = e.clientY;

			// Update cursor Y relative to the hovered item
			const currentOverId = overIdRef.current;
			if (currentOverId && currentOverId !== END_DROP_ZONE_ID) {
				const overElement = document.querySelector(
					`[data-id="${currentOverId}"]`,
				) as HTMLElement;
				if (overElement) {
					const rect = overElement.getBoundingClientRect();
					const relativeY = e.clientY - rect.top;
					cursorYRef.current = relativeY;
					overItemHeightRef.current = rect.height;

					// Only update state if isAbove changed to minimize re-renders
					const newIsAbove = relativeY < rect.height / 2;
					if (newIsAbove !== lastIsAboveRef.current) {
						lastIsAboveRef.current = newIsAbove;
						setCursorY(relativeY);
						setOverItemHeight(rect.height);
					}
				}
			}
		};

		document.addEventListener("mousemove", handleMouseMove);
		return () => document.removeEventListener("mousemove", handleMouseMove);
	}, [activeId]);

	const tree = useMemo(
		() =>
			nodes && Object.keys(nodes).length > 0
				? (createTree(nodes) as TreeNode)
				: null,
		[nodes],
	);

	// Expanded layers by selected nodes
	const expandedLayersBySelectedNodes = useMemo(
		() =>
			tree
				? getExpandedLayersBySelectedNodes(tree, Array.from(selectedNodeIds))
				: new Set<string>([]),
		[tree, selectedNodeIds],
	);

	// Sync expanded layers with selected nodes
	useEffect(() => {
		const newExpandedLayers = new Set<string>(expandedLayers);
		let hasChanges = false;

		for (const nodeId of expandedLayersBySelectedNodes) {
			if (!newExpandedLayers.has(nodeId)) {
				newExpandedLayers.add(nodeId);
				hasChanges = true;
			}
		}

		if (hasChanges) {
			setExpandedLayers(newExpandedLayers);
		}
	}, [expandedLayersBySelectedNodes, expandedLayers]);

	const allExpandedLayers = useMemo(
		() =>
			new Set([
				...Array.from(expandedLayers),
				...Array.from(expandedLayersBySelectedNodes),
			]),
		[expandedLayers, expandedLayersBySelectedNodes],
	);

	// Flatten tree with expanded state
	const flattenedItems = useMemo(() => {
		if (!tree) {
			return [];
		}

		const flattened = flattenTree(tree, allExpandedLayers);

		// When dragging, remove children of the dragged item from the list
		if (activeId) {
			return removeChildrenOf(flattened, [activeId]);
		}

		return flattened;
	}, [tree, allExpandedLayers, activeId]);

	// Projection for indicator
	const projectedRaw = useMemo(() => {
		if (!activeId) {
			lastValidProjectionRef.current = null;
			return null;
		}
		if (!overId) {
			// Return last valid projection to prevent flickering
			return lastValidProjectionRef.current;
		}
		// Handle end drop zone - calculate depth based on last item and drag offset
		if (overId === END_DROP_ZONE_ID) {
			const activeItem = flattenedItems.find((item) => item.id === activeId);
			if (!activeItem) {
				return null;
			}

			// Get the last item to calculate depth
			const lastItem = flattenedItems.at(-1);
			const dragDepth = Math.round(offsetLeft / INDENTATION_WIDTH);
			const projectedDepth = activeItem.depth + dragDepth;

			// Calculate max depth based on last item
			const maxDepth = lastItem
				? lastItem.canHaveChildren
					? lastItem.depth + 1
					: lastItem.depth
				: 0;
			const minDepth = 0;

			let depth = Math.max(minDepth, Math.min(maxDepth, projectedDepth));

			// Find valid parent at this depth
			let parentId: string | null = "root";
			if (lastItem && depth > 0) {
				// Walk up from last item to find parent at target depth
				let current: FlattenedNode | undefined = lastItem;
				while (current && current.depth >= depth) {
					if (current.depth === depth - 1 && current.canHaveChildren) {
						parentId = current.id;
						break;
					}
					current = flattenedItems.find(
						(item) => item.id === current?.parentId,
					);
				}
				if (!current && depth > 0) {
					parentId = lastItem.canHaveChildren ? lastItem.id : lastItem.parentId;
					depth = lastItem.canHaveChildren
						? lastItem.depth + 1
						: lastItem.depth;
				}
			}

			// Validate parent-child relationship
			const parentType =
				parentId === "root"
					? "root"
					: (flattenedItems.find((item) => item.id === parentId)?.node.type ??
						"root");
			if (!canBeChildOf(activeItem.node.type, parentType)) {
				return null;
			}

			return {
				depth,
				parentId,
				overId: END_DROP_ZONE_ID,
				isAbove: false,
			};
		}
		return getProjection(
			flattenedItems,
			activeId,
			overId,
			offsetLeft,
			INDENTATION_WIDTH,
			cursorY,
			overItemHeight,
		);
	}, [activeId, overId, offsetLeft, flattenedItems, cursorY, overItemHeight]);

	// Use raw projection or fall back to last valid to prevent flickering
	const projected = useMemo(() => {
		if (projectedRaw) {
			lastValidProjectionRef.current = projectedRaw;
			return projectedRaw;
		}
		// When no valid projection, use last valid one to prevent flickering
		return activeId ? lastValidProjectionRef.current : null;
	}, [projectedRaw, activeId]);

	// Calculate highlighted node IDs
	const highlightedIds = useMemo(() => {
		// Always include the active item when dragging
		const ids = new Set<string>();
		if (activeId) {
			ids.add(activeId);
		}

		if (!(projected && tree)) {
			// When no valid projection, highlight everything to avoid full dimming
			if (activeId && tree) {
				return getHighlightedNodeIds("root", tree);
			}
			return ids;
		}

		// Add the projected parent's subtree
		const subtreeIds = getHighlightedNodeIds(projected.parentId, tree);
		for (const id of subtreeIds) {
			ids.add(id);
		}
		return ids;
	}, [projected, tree, activeId]);

	const sortedIds = useMemo(
		() => [...flattenedItems.map(({ id }) => id), END_DROP_ZONE_ID],
		[flattenedItems],
	);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 5 },
		}),
	);

	// Handlers
	const toggleLayer = useCallback((id: string) => {
		setExpandedLayers((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, []);

	const handleSelect = useCallback(
		(id: string, many: boolean) => {
			dispatch(selectNode)({ id, many });
		},
		[dispatch],
	);

	const handleUnselect = useCallback(
		(id: string) => {
			dispatch(unselectNode)({ id });
		},
		[dispatch],
	);

	const handleDragStart = useCallback(({ active }: DragStartEvent) => {
		setActiveId(active.id as string);
		setOverId(active.id as string);
		setCursorY(0);
	}, []);

	const handleDragMove = useCallback(({ delta }: DragMoveEvent) => {
		setOffsetLeft(delta.x);
	}, []);

	const handleDragOver = useCallback(
		({ over }: DragOverEvent) => {
			const rawOverId = over?.id as string | null;
			// Use last valid overId if current is null to prevent flickering in gaps
			const newOverId = rawOverId ?? lastValidOverIdRef.current;
			if (rawOverId) {
				lastValidOverIdRef.current = rawOverId;
			}

			// When over item changes, update cursor position immediately
			if (
				newOverId &&
				newOverId !== overIdRef.current &&
				newOverId !== END_DROP_ZONE_ID
			) {
				const overElement = document.querySelector(
					`[data-id="${newOverId}"]`,
				) as HTMLElement;
				if (overElement) {
					const rect = overElement.getBoundingClientRect();
					const relativeY = mouseYRef.current - rect.top;
					cursorYRef.current = relativeY;
					overItemHeightRef.current = rect.height;
					lastIsAboveRef.current = relativeY < rect.height / 2;
					setCursorY(relativeY);
					setOverItemHeight(rect.height);
				}
			}

			setOverId(newOverId);

			// Handle auto-expand for collapsed items
			if (newOverId && newOverId !== END_DROP_ZONE_ID && activeId) {
				const overItem = flattenedItems.find((item) => item.id === newOverId);
				if (
					overItem?.canHaveChildren &&
					overItem.node.children.length > 0 &&
					!allExpandedLayers.has(newOverId)
				) {
					// Check if we're already tracking this item
					if (hoverExpandTimer?.nodeId !== newOverId) {
						// Clear existing timer
						if (hoverExpandTimer) {
							clearTimeout(hoverExpandTimer.timeoutId);
						}
						// Start new timer
						const timeoutId = setTimeout(() => {
							toggleLayer(newOverId);
							setHoverExpandTimer(null);
						}, 3000);
						setHoverExpandTimer({ nodeId: newOverId, timeoutId });
					}
				}
				// Clear timer if not over a collapsed item
				else if (hoverExpandTimer) {
					clearTimeout(hoverExpandTimer.timeoutId);
					setHoverExpandTimer(null);
				}
			}
			// Clear timer if not over a valid item
			else if (hoverExpandTimer) {
				clearTimeout(hoverExpandTimer.timeoutId);
				setHoverExpandTimer(null);
			}
		},
		[
			activeId,
			flattenedItems,
			allExpandedLayers,
			hoverExpandTimer,
			toggleLayer,
		],
	);

	const resetState = useCallback(() => {
		setActiveId(null);
		setOverId(null);
		setOffsetLeft(0);
		setCursorY(0);
		setOverItemHeight(28);
		lastValidOverIdRef.current = null;
		lastValidProjectionRef.current = null;
		overIdRef.current = null;
		cursorYRef.current = 0;
		overItemHeightRef.current = 28;
		lastIsAboveRef.current = true;
		if (hoverExpandTimer) {
			clearTimeout(hoverExpandTimer.timeoutId);
			setHoverExpandTimer(null);
		}
	}, [hoverExpandTimer]);

	const handleDragEnd = useCallback(
		({ active, over }: DragEndEvent) => {
			resetState();

			if (!projected) {
				return;
			}
			if (!over) {
				return;
			}

			const { parentId, isAbove } = projected;
			const newParentId = parentId ?? "root";

			// Handle end drop zone - place at end of parent
			if (over.id === END_DROP_ZONE_ID) {
				dispatch(moveNode)({
					nodeId: active.id as string,
					newParentId,
					beforeSiblingId: null,
				});
				return;
			}

			// Find the sibling to insert before based on isAbove
			let beforeSiblingId: string | null = null;
			if (isAbove) {
				// Insert before the over item
				const overItem = flattenedItems.find((item) => item.id === over.id);
				if (overItem && overItem.parentId === newParentId) {
					beforeSiblingId = overItem.id;
				}
			} else {
				// Insert after the over item - find next sibling
				beforeSiblingId = getSiblingAfter(
					flattenedItems,
					over.id as string,
					newParentId,
				);
			}

			dispatch(moveNode)({
				nodeId: active.id as string,
				newParentId,
				beforeSiblingId,
			});
		},
		[dispatch, flattenedItems, projected, resetState],
	);

	const handleDragCancel = useCallback(() => {
		resetState();
	}, [resetState]);

	return (
		<DndContext
			collisionDetection={closestCenter}
			measuring={measuring}
			onDragCancel={handleDragCancel}
			onDragEnd={handleDragEnd}
			onDragMove={handleDragMove}
			onDragOver={handleDragOver}
			onDragStart={handleDragStart}
			sensors={sensors}
		>
			<SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
				<div>
					{flattenedItems.length > 0 ? (
						flattenedItems.map((item, index) => (
							<SortableTreeItemWrapper
								activeId={activeId}
								allExpandedLayers={allExpandedLayers}
								flattenedItems={flattenedItems}
								highlightedIds={highlightedIds}
								indentationWidth={INDENTATION_WIDTH}
								isFirst={index === 0}
								isLast={index === flattenedItems.length - 1}
								item={item}
								key={item.id}
								onSelect={handleSelect}
								onToggle={toggleLayer}
								onUnselect={handleUnselect}
								projected={projected}
								selectedNodeIds={Array.from(selectedNodeIds)}
							/>
						))
					) : (
						<div className="px-4 py-2 font-medium text-muted-foreground text-xs">
							No layers yet
						</div>
					)}
					{/* End drop zone indicator */}
					{projected &&
						projected.overId === END_DROP_ZONE_ID &&
						flattenedItems.length > 0 && (
							<div
								className="pointer-events-none relative h-0.5 bg-primary"
								style={{
									marginLeft: `${projected.depth * INDENTATION_WIDTH}px`,
								}}
							/>
						)}
				</div>
			</SortableContext>
		</DndContext>
	);
}

// Wrapper to handle selection state subscription
interface SortableTreeItemWrapperProps {
	item: FlattenedNode;
	indentationWidth: number;
	projected: Projection | null;
	activeId: string | null;
	onSelect: (id: string, many: boolean) => void;
	onUnselect: (id: string) => void;
	onToggle: (id: string) => void;
	allExpandedLayers: Set<string>;
	isFirst: boolean;
	isLast: boolean;
	highlightedIds: Set<string>;
	flattenedItems: FlattenedNode[];
	selectedNodeIds: string[];
}

function SortableTreeItemWrapper({
	item,
	indentationWidth,
	projected,
	activeId,
	onSelect,
	onUnselect,
	onToggle,
	allExpandedLayers,
	isFirst,
	isLast,
	highlightedIds,
	flattenedItems,
	selectedNodeIds,
}: SortableTreeItemWrapperProps) {
	const store = usePaywallDesignerStore();
	const isSelected = useStore(
		store,
		useShallow((state) => state.selectedNodeIds.includes(item.id)),
	);

	const isHighlighted = highlightedIds.has(item.id);
	const isChildOfSelected = isDescendantOfSelected(
		item,
		flattenedItems,
		selectedNodeIds,
	);

	return (
		<SortableTreeItem
			activeId={activeId}
			depth={item.depth}
			hasChildren={item.node.children.length > 0}
			id={item.id}
			indentationWidth={indentationWidth}
			isChildOfSelected={isChildOfSelected}
			isExpanded={allExpandedLayers.has(item.id)}
			isFirst={isFirst}
			isHighlighted={isHighlighted}
			isLast={isLast}
			isSelected={isSelected}
			node={item.node}
			onSelect={onSelect}
			onToggle={onToggle}
			onUnselect={onUnselect}
			projected={projected}
		/>
	);
}

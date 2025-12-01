'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  MeasuringStrategy,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { cn } from '@voidhash/ui';
import {
  ChevronDown,
  ChevronRight,
  Columns2Icon,
  Rows2Icon,
  Smartphone,
  TypeIcon
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  useDesignerActions,
  useDesignerSelect
} from '../../state/designer-store';
import type { NodeData } from '../../state/schema';
import { createTree } from '../../state/utils/nodes';

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
}

// ============================================================================
// Constants
// ============================================================================

const INDENTATION_WIDTH = 16;

const typeIcons = {
  screen: Smartphone,
  text: TypeIcon,
  column: Columns2Icon,
  row: Rows2Icon,
  root: null
} as const;

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always
  }
};

const dropAnimationConfig: DropAnimation = {
  keyframes({ transform }) {
    const toTransformString = (t: {
      x: number;
      y: number;
      scaleX: number;
      scaleY: number;
    }) =>
      `translate3d(${t.x}px, ${t.y}px, 0) scaleX(${t.scaleX}) scaleY(${t.scaleY})`;
    return [
      { opacity: 1, transform: toTransformString(transform.initial) },
      {
        opacity: 0,
        transform: toTransformString({
          ...transform.final,
          x: transform.final.x + 5,
          y: transform.final.y + 5
        })
      }
    ];
  },
  easing: 'ease-out',
  sideEffects({ active }) {
    active.node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 250,
      easing: 'ease'
    });
  }
};

const adjustTranslate: Modifier = ({ transform }) => ({
  ...transform,
  y: transform.y - 25
});

// ============================================================================
// Utility Functions
// ============================================================================

function flattenTree(
  node: TreeNode,
  expandedLayers: Set<string>,
  depth = 0,
  parentId: string | null = null,
  result: FlattenedNode[] = []
): FlattenedNode[] {
  if (node.type === 'root') {
    for (const child of node.children) {
      flattenTree(child, expandedLayers, depth, node.id, result);
    }
    return result;
  }

  const canHaveChildren =
    node.type === 'screen' || node.type === 'column' || node.type === 'row';

  result.push({
    id: node.id,
    node,
    depth,
    parentId,
    index: result.length,
    canHaveChildren
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
  ids: string[]
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
  indentationWidth: number
): Projection | null {
  const overItemIndex = items.findIndex(({ id }) => id === overId);
  const activeItemIndex = items.findIndex(({ id }) => id === activeId);
  const activeItem = items[activeItemIndex];

  if (!activeItem) {
    return null;
  }

  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];

  const dragDepth = Math.round(dragOffset / indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;

  const maxDepth = getMaxDepth(previousItem);
  const minDepth = getMinDepth(nextItem);

  let depth = projectedDepth;
  if (projectedDepth >= maxDepth) {
    depth = maxDepth;
  } else if (projectedDepth < minDepth) {
    depth = minDepth;
  }

  const parentId = getParentId(previousItem, depth, items);

  return { depth, parentId, overId };
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
  items: FlattenedNode[]
): string | null {
  if (!previousItem) {
    return 'root';
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

  return current?.parentId ?? 'root';
}

function getSiblingAfter(
  items: FlattenedNode[],
  overId: string,
  targetParentId: string | null
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

// ============================================================================
// Components
// ============================================================================

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
  hasChildren
}: SortableTreeItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id });

  const Icon = typeIcons[node.type];
  const displayName = 'name' in node ? node.name : 'Unknown';

  const isActiveItem = id === activeId;
  const showIndicator = projected && projected.overId === id && !isActiveItem;

  const indentStyle: React.CSSProperties = {
    paddingLeft: `${depth * indentationWidth}px`
  };

  return (
    <div
      className={cn('relative', isDragging && 'z-10 opacity-50')}
      ref={setNodeRef}
    >
      {/* Drop indicator line */}
      {showIndicator && (
        <div
          className="absolute right-0 left-0 h-0.5 bg-primary"
          style={{
            top: -1,
            marginLeft: `${(projected?.depth ?? depth) * indentationWidth}px`
          }}
        />
      )}

      <div
        className={cn(
          'flex cursor-grab items-center gap-1 rounded-md px-1 py-1 hover:bg-white/[0.04] active:cursor-grabbing',
          isSelected && 'bg-primary/20 hover:bg-primary/20'
        )}
        style={indentStyle}
        {...attributes}
        {...listeners}
      >
        {/* Expand/Collapse Toggle */}
        <button
          className="flex items-center rounded-md p-0.5 hover:bg-white/[0.08]"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          type="button"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3 text-white/40" />
            ) : (
              <ChevronRight className="h-3 w-3 text-white/40" />
            )
          ) : (
            <span className="w-3" />
          )}
        </button>

        {/* Node Content */}
        <button
          className="flex flex-1 items-center gap-1.5"
          onClick={(e) => {
            if (isSelected && e.shiftKey) {
              onUnselect(id);
            } else {
              onSelect(id, e.shiftKey);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          type="button"
        >
          {Icon && <Icon className="h-3.5 w-3.5 text-white/40" />}
          <span className="truncate text-white/80 text-xs">{displayName}</span>
        </button>
      </div>
    </div>
  );
}

interface DragOverlayContentProps {
  node: TreeNode;
  depth: number;
  indentationWidth: number;
}

function DragOverlayContent({
  node,
  depth,
  indentationWidth
}: DragOverlayContentProps) {
  const Icon = typeIcons[node.type];
  const displayName = 'name' in node ? node.name : 'Unknown';

  return (
    <div
      className="flex items-center gap-1.5 rounded-md bg-neutral-900/95 px-2 py-1.5 shadow-xl ring-1 ring-primary/50"
      style={{ marginLeft: `${depth * indentationWidth}px` }}
    >
      {Icon && <Icon className="h-3.5 w-3.5 text-white/40" />}
      <span className="truncate text-white/80 text-xs">{displayName}</span>
    </div>
  );
}

// ============================================================================
// Expanded Layers Logic
// ============================================================================

const getExpandedLayersBySelectedNodes = (
  tree: TreeNode,
  selectedNodeIds: string[]
): Set<string> => {
  const reduceExpandedNodeIdsToSet = (
    node: TreeNode,
    selectedIds: string[]
  ): Set<string> => {
    if (node.children.length === 0) {
      if (selectedIds.includes(node.id)) {
        return new Set([node.id]);
      }
      return new Set([]);
    }

    const childrenExpandedIds = node.children.flatMap((child) =>
      Array.from(reduceExpandedNodeIdsToSet(child, selectedIds))
    );

    return new Set([
      ...childrenExpandedIds,
      ...(childrenExpandedIds.length > 0 ? [node.id] : [])
    ]);
  };

  return tree ? reduceExpandedNodeIdsToSet(tree, selectedNodeIds) : new Set([]);
};

// ============================================================================
// Main Component
// ============================================================================

export function LayersSection() {
  const selectedNodeIds = useDesignerSelect((state) => state.selectedNodeIds);
  const nodes = useDesignerSelect((state) => state.nodes);
  const dispatch = useDesignerActions();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(
    new Set([])
  );

  const tree = useMemo(
    () =>
      nodes && Object.keys(nodes).length > 0
        ? (createTree(nodes) as TreeNode)
        : null,
    [nodes]
  );

  // Expanded layers by selected nodes
  const expandedLayersBySelectedNodes = useMemo(
    () =>
      tree
        ? getExpandedLayersBySelectedNodes(tree, selectedNodeIds)
        : new Set<string>([]),
    [tree, selectedNodeIds]
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
        ...Array.from(expandedLayersBySelectedNodes)
      ]),
    [expandedLayers, expandedLayersBySelectedNodes]
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
  const projected = useMemo(() => {
    if (!activeId) {
      return null;
    }
    if (!overId) {
      return null;
    }
    return getProjection(
      flattenedItems,
      activeId,
      overId,
      offsetLeft,
      INDENTATION_WIDTH
    );
  }, [activeId, overId, offsetLeft, flattenedItems]);

  const activeItem = useMemo(
    () => flattenedItems.find(({ id }) => id === activeId),
    [activeId, flattenedItems]
  );

  const sortedIds = useMemo(
    () => flattenedItems.map(({ id }) => id),
    [flattenedItems]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
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
      dispatch('selectNode', { id, many });
    },
    [dispatch]
  );

  const handleUnselect = useCallback(
    (id: string) => {
      dispatch('unselectNode', { id });
    },
    [dispatch]
  );

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
    setOverId(active.id as string);
    document.body.style.setProperty('cursor', 'grabbing');
  }, []);

  const handleDragMove = useCallback(({ delta }: DragMoveEvent) => {
    setOffsetLeft(delta.x);
  }, []);

  const handleDragOver = useCallback(({ over }: DragOverEvent) => {
    setOverId(over?.id as string | null);
  }, []);

  const resetState = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
    document.body.style.setProperty('cursor', '');
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      resetState();

      if (!projected) {
        return;
      }
      if (!over) {
        return;
      }

      const { parentId } = projected;
      const newParentId = parentId ?? 'root';

      // Find the sibling to insert before
      const beforeSiblingId = getSiblingAfter(
        flattenedItems,
        over.id as string,
        newParentId
      );

      dispatch('moveNode', {
        nodeId: active.id as string,
        newParentId,
        beforeSiblingId
      });
    },
    [dispatch, flattenedItems, projected, resetState]
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
        <div className="space-y-0.5">
          {flattenedItems.length > 0 ? (
            flattenedItems.map((item) => (
              <SortableTreeItemWrapper
                activeId={activeId}
                allExpandedLayers={allExpandedLayers}
                indentationWidth={INDENTATION_WIDTH}
                item={item}
                key={item.id}
                onSelect={handleSelect}
                onToggle={toggleLayer}
                onUnselect={handleUnselect}
                projected={projected}
              />
            ))
          ) : (
            <div className="px-2 py-1.5 text-white/40 text-xs">
              No layers yet
            </div>
          )}
        </div>
      </SortableContext>

      {typeof document !== 'undefined' &&
        createPortal(
          <DragOverlay
            dropAnimation={dropAnimationConfig}
            modifiers={[adjustTranslate]}
          >
            {activeId && activeItem ? (
              <DragOverlayContent
                depth={activeItem.depth}
                indentationWidth={INDENTATION_WIDTH}
                node={activeItem.node}
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}
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
}

function SortableTreeItemWrapper({
  item,
  indentationWidth,
  projected,
  activeId,
  onSelect,
  onUnselect,
  onToggle,
  allExpandedLayers
}: SortableTreeItemWrapperProps) {
  const isSelected = useDesignerSelect(
    useShallow((state) => state.selectedNodeIds.includes(item.id))
  );

  return (
    <SortableTreeItem
      activeId={activeId}
      depth={item.depth}
      hasChildren={item.node.children.length > 0}
      id={item.id}
      indentationWidth={indentationWidth}
      isExpanded={allExpandedLayers.has(item.id)}
      isSelected={isSelected}
      node={item.node}
      onSelect={onSelect}
      onToggle={onToggle}
      onUnselect={onUnselect}
      projected={projected}
    />
  );
}

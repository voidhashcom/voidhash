'use client';

import { cn } from '@voidhash/ui';
import { ChevronDown, ChevronRight, Smartphone, TypeIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  useDesignerActions,
  useDesignerSelect
} from '../../state/designer-store';
import type { NodeData } from '../../state/schema';
import { createTree } from '../../state/utils/nodes';

type TreeNode = NodeData & {
  children: TreeNode[];
};

const typeIcons = {
  screen: Smartphone,
  text: TypeIcon,
  root: null // Root nodes shouldn't be displayed
} as const;

interface TreeNodeItemProps {
  node: TreeNode;
  expandedLayers: Set<string>;
  onSelect: (id: string, many: boolean) => void;
  onUnselect: (id: string) => void;
  toggleLayer: (id: string) => void;
  depth?: number;
}

function TreeNodeItem({
  toggleLayer,
  node,
  expandedLayers,
  onSelect,
  onUnselect,
  depth = 0
}: TreeNodeItemProps) {
  const isExpanded = expandedLayers.has(node.id);
  const hasChildren = node.children.length > 0;
  const Icon = typeIcons[node.type];
  const displayName = 'name' in node ? node.name : 'Root';
  const isSelected = useDesignerSelect(
    useShallow((state) => state.selectedNodeIds.includes(node.id))
  );

  // Don't render root nodes, only their children
  if (node.type === 'root') {
    return (
      <>
        {node.children.map((child) => (
          <TreeNodeItem
            depth={depth}
            expandedLayers={expandedLayers}
            key={child.id}
            node={child}
            onSelect={onSelect}
            onUnselect={onUnselect}
            toggleLayer={toggleLayer}
          />
        ))}
      </>
    );
  }

  return (
    <div>
      <button
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-white/[0.04]',
          isSelected ? 'bg-primary/20 hover:bg-primary/20' : ''
        )}
        onClick={(event) => {
          const isShiftPressed = event.shiftKey;
          if (isSelected && isShiftPressed) {
            onUnselect(node.id);
          } else {
            onSelect(node.id, isShiftPressed);
          }
        }}
        style={{ paddingLeft: `${0.5 + depth * 0.5}rem` }}
        type="button"
      >
        {/** biome-ignore lint/a11y/useSemanticElements: TODO: Cant use semantic elements inside button */}
        <div
          className="flex items-center gap-1.5 rounded-md p-0.5 text-left hover:bg-white/[0.04]"
          onClick={(event) => {
            event.stopPropagation();
            toggleLayer(node.id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.stopPropagation();
              toggleLayer(node.id);
            }
          }}
          role="button"
          tabIndex={0}
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
        </div>
        {Icon && <Icon className="h-3.5 w-3.5 text-white/40" />}
        <span className="truncate text-white/80 text-xs">{displayName}</span>
      </button>

      {isExpanded && hasChildren && (
        <div className="space-y-0.5 border-white/[0.06] border-l pl-2">
          {node.children.map((child) => (
            <TreeNodeItem
              depth={depth + 1}
              expandedLayers={expandedLayers}
              key={child.id}
              node={child}
              onSelect={onSelect}
              onUnselect={onUnselect}
              toggleLayer={toggleLayer}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const getExpandedLayersBySelectedNodes = (
  tree: TreeNode,
  selectedNodeIds: string[]
): Set<string> => {
  const reduceExpandedNodeIdsToSet = (
    node: TreeNode,
    selectedNodeIds: string[]
  ): Set<string> => {
    // If the node has no children, return the set of selected node ids
    if (node.children.length === 0) {
      if (selectedNodeIds.includes(node.id)) {
        return new Set([node.id]);
      }
      return new Set([]);
    }

    // Get the expanded children ids
    const childrenExpandedIds = node.children.flatMap((child) =>
      Array.from(reduceExpandedNodeIdsToSet(child, selectedNodeIds))
    );

    // If the node has expanded children, expand the node itself
    return new Set([
      ...childrenExpandedIds,
      ...(childrenExpandedIds.length > 0 ? [node.id] : [])
    ]);
  };
  return tree ? reduceExpandedNodeIdsToSet(tree, selectedNodeIds) : new Set([]);
};

export function LayersSection() {
  const selectedNodeIds = useDesignerSelect((state) => state.selectedNodeIds);

  const nodes = useDesignerSelect((state) => state.nodes);
  const dispatch = useDesignerActions();

  const tree =
    nodes && Object.keys(nodes).length > 0
      ? (createTree(nodes) as TreeNode)
      : null;

  const toggleLayer = (id: string) => {
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Expanded layers
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(
    new Set([])
  );

  // --- Layers expanded by selected nodes
  const expandedLayersBySelectedNodes = useMemo(
    () =>
      tree
        ? getExpandedLayersBySelectedNodes(tree, selectedNodeIds)
        : new Set([]),
    [tree, selectedNodeIds]
  );

  useEffect(() => {
    const newExpandedLayers = new Set<string>(expandedLayers);
    const expandedLayersHasAllSelectedNodes = Array.from(
      expandedLayersBySelectedNodes
    ).every((nodeId) => expandedLayers.has(nodeId));

    if (!expandedLayersHasAllSelectedNodes) {
      for (const nodeId of expandedLayersBySelectedNodes) {
        if (!newExpandedLayers.has(nodeId)) {
          newExpandedLayers.add(nodeId);
        }
      }
      setExpandedLayers(newExpandedLayers);
    }
  }, [expandedLayersBySelectedNodes, expandedLayers]);

  const allExpandedLayers = useMemo(() => {
    return new Set([
      ...Array.from(expandedLayers),
      ...Array.from(expandedLayersBySelectedNodes)
    ]);
  }, [expandedLayers, expandedLayersBySelectedNodes]);

  const handleSelect = (id: string, many: boolean) => {
    dispatch('selectNode', { id, many });
  };

  const handleUnselect = (id: string) => {
    dispatch('unselectNode', { id });
  };

  return (
    <div className="space-y-0.5">
      {tree ? (
        <TreeNodeItem
          expandedLayers={allExpandedLayers}
          node={tree}
          onSelect={handleSelect}
          onUnselect={handleUnselect}
          toggleLayer={toggleLayer}
        />
      ) : (
        <div className="px-2 py-1.5 text-white/40 text-xs">No layers yet</div>
      )}
    </div>
  );
}

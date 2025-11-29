'use client';

import { cn } from '@voidhash/ui';
import { ChevronDown, ChevronRight, Smartphone } from 'lucide-react';
import { useState } from 'react';
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
  root: null // Root nodes shouldn't be displayed
} as const;

function getNodeDisplayName(node: NodeData): string {
  switch (node.type) {
    case 'screen':
      return `Screen ${node.width}×${node.height}`;
    case 'root':
      return 'Root';
    default:
      // Exhaustiveness check - should never reach here
      return (node as NodeData).id;
  }
}

interface TreeNodeItemProps {
  node: TreeNode;
  expandedLayers: Set<string>;
  onSelect: (id: string, many: boolean) => void;
  onUnselect: (id: string) => void;
  depth?: number;
}

function TreeNodeItem({
  node,
  expandedLayers,
  onSelect,
  onUnselect,
  depth = 0
}: TreeNodeItemProps) {
  const isExpanded = expandedLayers.has(node.id);
  const hasChildren = node.children.length > 0;
  const Icon = node.type === 'screen' ? typeIcons.screen : null;
  const displayName = getNodeDisplayName(node);
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
        style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LayersSection() {
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(
    new Set([])
  );

  const nodes = useDesignerSelect((state) => state.nodes);
  const dispatch = useDesignerActions();

  const tree =
    nodes && Object.keys(nodes).length > 0
      ? (createTree(nodes) as TreeNode)
      : null;

  //   const toggleLayer = (id: string) => {
  //     setExpandedLayers((prev) => {
  //       const next = new Set(prev);
  //       if (next.has(id)) {
  //         next.delete(id);
  //       } else {
  //         next.add(id);
  //       }
  //       return next;
  //     });
  //   };

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
          expandedLayers={expandedLayers}
          node={tree}
          onSelect={handleSelect}
          onUnselect={handleUnselect}
        />
      ) : (
        <div className="px-2 py-1.5 text-white/40 text-xs">No layers yet</div>
      )}
    </div>
  );
}

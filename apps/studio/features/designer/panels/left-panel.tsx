'use client';

import { ChevronDown, ChevronRight, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useDesignerSelect } from '../state/designer-store';
import type { NodeData } from '../state/schema';
import { createTree } from '../state/utils/nodes';
import { PANEL_DIMENSIONS } from './constants';
import { Panel } from './core/components/panel';

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
  onToggle: (id: string) => void;
  depth?: number;
}

function TreeNodeItem({
  node,
  expandedLayers,
  onToggle,
  depth = 0
}: TreeNodeItemProps) {
  const isExpanded = expandedLayers.has(node.id);
  const hasChildren = node.children.length > 0;
  const Icon = node.type === 'screen' ? typeIcons.screen : null;
  const displayName = getNodeDisplayName(node);

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
            onToggle={onToggle}
          />
        ))}
      </>
    );
  }

  return (
    <div>
      <button
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
        onClick={() => {
          onToggle(node.id);
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
        {Icon && <Icon className="h-3.5 w-3.5 text-violet-400" />}
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
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LeftPanel() {
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(
    new Set([])
  );

  const nodes = useDesignerSelect((state) => state.nodes);
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

  return (
    <div
      className="fixed bottom-0 left-0 z-40 flex flex-col border-border border-r bg-sidebar backdrop-blur-xl"
      style={{
        top: PANEL_DIMENSIONS.TOP_HEIGHT,
        width: PANEL_DIMENSIONS.LEFT_WIDTH
      }}
    >
      <Panel>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-0.5">
            {tree ? (
              <TreeNodeItem
                expandedLayers={expandedLayers}
                node={tree}
                onToggle={toggleLayer}
              />
            ) : (
              <div className="px-2 py-1.5 text-white/40 text-xs">
                No layers yet
              </div>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

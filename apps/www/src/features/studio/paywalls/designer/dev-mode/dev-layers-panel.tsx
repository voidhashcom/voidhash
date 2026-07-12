"use client";

import {
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@voidhash/ui";
import {
  ChevronDown,
  ChevronRight,
  Columns2Icon,
  Rows2Icon,
  Smartphone,
  SquareDashedIcon,
  TypeIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

import { deleteNodes, selectNode } from "../state/actions";
import { usePaywallDesignerActions } from "../state/designer-store";

/**
 * Structural view of designer snapshot nodes carrying just the fields the
 * dev layers tree reads. Snapshot nodes nest their payload under `data`;
 * `style` stays untyped because each node type carries a different struct.
 */
interface SnapshotNode {
  id: string;
  type: string;
  // `path`/`source` (a `codeComponent`'s data) keep this from being a "weak
  // type" so the whole `RootSnapshotNode` tree assigns here.
  data?: {
    name?: string;
    style?: Record<string, unknown>;
    path?: string;
    source?: string;
  };
  children?: readonly SnapshotNode[];
}

interface DevLayersPanelProps {
  snapshot: SnapshotNode | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string, jsonPath: string) => void;
}

interface LayerItemProps {
  node: SnapshotNode;
  depth: number;
  basePath: string;
  selectedNodeId: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (nodeId: string, jsonPath: string) => void;
}

const INDENT_WIDTH = 16;

const typeIcons = {
  column: Rows2Icon,
  root: null,
  row: Columns2Icon,
  screen: Smartphone,
  text: TypeIcon,
  view: SquareDashedIcon,
} as const;

function getIconType(node: SnapshotNode): keyof typeof typeIcons {
  if (node.type === "view") {
    const hasChildren = (node.children?.length ?? 0) > 0;
    if (!hasChildren) return "view";
    return node.data?.style?.["flexDirection"] === "column" ? "column" : "row";
  }
  return node.type as keyof typeof typeIcons;
}

function LayerItem({
  node,
  depth,
  basePath,
  selectedNodeId,
  expandedIds,
  onToggle,
  onSelect,
}: LayerItemProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const iconType = getIconType(node);
  const Icon = typeIcons[iconType];
  const displayName = node.data?.name ?? node.type;

  // Skip root node in display but process children
  if (node.type === "root") {
    return (
      <>
        {node.children?.map((child, index) => (
          <LayerItem
            key={child.id}
            node={child}
            depth={depth}
            basePath={`${basePath}.children.${index}`}
            selectedNodeId={selectedNodeId}
            expandedIds={expandedIds}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
      </>
    );
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggle(node.id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return;
    onSelect(node.id, basePath);
  };

  const indentStyle = { paddingLeft: `${depth * INDENT_WIDTH}px` };

  return (
    <>
      <LayerItemContextMenu
        nodeId={node.id}
        nodeType={node.type}
        onSelectNode={() => onSelect(node.id, basePath)}
      >
        <div
          className={cn(
            "flex h-7 items-center gap-1 rounded-sm px-1 cursor-pointer hover:bg-accent/50",
            isSelected && "bg-accent text-accent-foreground",
          )}
          style={indentStyle}
          onMouseDown={handleMouseDown}
        >
          <button
            className="flex shrink-0 items-center rounded-sm p-0.5 hover:bg-accent"
            onMouseDown={handleToggle}
            type="button"
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="size-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3 text-muted-foreground" />
              )
            ) : (
              <span className="size-3" />
            )}
          </button>
          <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
            {Icon && (
              <span className="flex size-3.5 shrink-0 items-center justify-center">
                <Icon className="size-3.5 text-muted-foreground" />
              </span>
            )}
            <span className="truncate font-medium text-xs">{displayName}</span>
          </div>
        </div>
      </LayerItemContextMenu>
      {isExpanded &&
        node.children?.map((child, index) => (
          <LayerItem
            key={child.id}
            node={child}
            depth={depth + 1}
            basePath={`${basePath}.children.${index}`}
            selectedNodeId={selectedNodeId}
            expandedIds={expandedIds}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

function LayerItemContextMenu({
  children,
  nodeId,
  nodeType,
  onSelectNode,
}: {
  children: React.ReactNode;
  nodeId: string;
  nodeType: string;
  onSelectNode: () => void;
}) {
  const dispatch = usePaywallDesignerActions();

  // Don't allow deleting root or screen nodes
  const canDelete = nodeType !== "root" && nodeType !== "screen";

  const handleDelete = () => {
    // First select the node in the designer store to ensure it's the deletion target
    dispatch(selectNode)({ id: nodeId, many: false });
    // Update the local dev-mode selection state
    onSelectNode();
    // Then delete it
    dispatch(deleteNodes)({});
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={handleDelete} disabled={!canDelete}>
          Delete node
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function DevLayersPanel({ snapshot, selectedNodeId, onSelectNode }: DevLayersPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Start with all nodes expanded for dev inspection
    const ids = new Set<string>();
    const collectIds = (node: SnapshotNode) => {
      ids.add(node.id);
      for (const child of node.children ?? []) {
        collectIds(child);
      }
    };
    if (snapshot) {
      collectIds(snapshot);
    }
    return ids;
  });

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
        No snapshot data
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-2">
      <div className="mb-2 px-1 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
        Layers
      </div>
      <LayerItem
        node={snapshot}
        depth={0}
        basePath="root"
        selectedNodeId={selectedNodeId}
        expandedIds={expandedIds}
        onToggle={handleToggle}
        onSelect={onSelectNode}
      />
    </div>
  );
}

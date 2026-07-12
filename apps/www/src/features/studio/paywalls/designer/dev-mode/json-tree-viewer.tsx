"use client";

import {
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@voidhash/ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface JsonTreeViewerProps {
  data: unknown;
  highlightPath?: string | null;
  searchQuery?: string;
  onPathChange?: (path: string | null) => void;
}

interface JsonNodeProps {
  value: unknown;
  path: string;
  keyName?: string;
  depth: number;
  highlightPath: string | null;
  searchQuery: string;
  matchingPaths: Set<string>;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onPathChange?: (path: string | null) => void;
}

const INDENT_WIDTH = 16;

function getValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function getPreview(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    if (keys.length <= 3) {
      return `{ ${keys.join(", ")} }`;
    }
    return `{ ${keys.slice(0, 3).join(", ")}, ... }`;
  }
  return "";
}

// Copy to clipboard helper
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
}

// Highlight matching text in a string
function HighlightedText({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  if (!query) {
    return <span className={className}>{text}</span>;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {text.slice(0, index)}
      <mark className="bg-yellow-300 dark:bg-yellow-600 rounded-sm px-0.5">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </span>
  );
}

// Context menu for JSON nodes
function JsonNodeContextMenu({
  children,
  value,
  path,
  keyName,
}: {
  children: React.ReactNode;
  value: unknown;
  path: string;
  keyName?: string;
}) {
  const type = getValueType(value);

  const handleCopyValue = () => {
    if (type === "object" || type === "array") {
      copyToClipboard(JSON.stringify(value, null, 2));
    } else if (value === null) {
      copyToClipboard("null");
    } else {
      copyToClipboard(String(value));
    }
  };

  const handleCopyJson = () => {
    copyToClipboard(JSON.stringify(value, null, 2));
  };

  const handleCopyJsonCompact = () => {
    copyToClipboard(JSON.stringify(value));
  };

  const handleCopyPath = () => {
    // Convert internal path format to a more readable format
    // e.g., "root.children.0.id" -> "children[0].id"
    const readablePath = path.replace(/^root\.?/, "").replace(/\.(\d+)/g, "[$1]");
    copyToClipboard(readablePath || "(root)");
  };

  const handleCopyKey = () => {
    if (keyName !== undefined) {
      copyToClipboard(keyName);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={handleCopyValue}>Copy value</ContextMenuItem>
        {(type === "object" || type === "array") && (
          <>
            <ContextMenuItem onSelect={handleCopyJson}>Copy JSON (formatted)</ContextMenuItem>
            <ContextMenuItem onSelect={handleCopyJsonCompact}>Copy JSON (compact)</ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={handleCopyPath}>Copy path</ContextMenuItem>
        {keyName !== undefined && (
          <ContextMenuItem onSelect={handleCopyKey}>Copy key</ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function JsonNode({
  value,
  path,
  keyName,
  depth,
  highlightPath,
  searchQuery,
  matchingPaths,
  expandedPaths,
  onToggle,
  onPathChange,
}: JsonNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const type = getValueType(value);
  const isExpandable = type === "object" || type === "array";
  const isExpanded = expandedPaths.has(path);
  const isHighlighted = highlightPath === path;
  const isSearchMatch = matchingPaths.has(path);

  // Scroll into view when highlighted
  useEffect(() => {
    if (isHighlighted && nodeRef.current) {
      nodeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [isHighlighted]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggle(path);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return;
    onPathChange?.(path);
  };

  const renderValue = () => {
    const stringValue = String(value);
    switch (type) {
      case "string":
        return (
          <span className="text-green-600">
            &quot;
            <HighlightedText text={stringValue} query={searchQuery} />
            &quot;
          </span>
        );
      case "number":
        return <HighlightedText text={stringValue} query={searchQuery} className="text-blue-600" />;
      case "boolean":
        return (
          <HighlightedText text={stringValue} query={searchQuery} className="text-purple-600" />
        );
      case "null":
        return <span className="text-gray-500">null</span>;
      case "undefined":
        return <span className="text-gray-500">undefined</span>;
      default:
        return null;
    }
  };

  const indentStyle = { paddingLeft: `${depth * INDENT_WIDTH}px` };

  if (!isExpandable) {
    return (
      <JsonNodeContextMenu value={value} path={path} keyName={keyName}>
        <div
          ref={nodeRef}
          className={cn(
            "flex items-center py-0.5 hover:bg-accent/30 cursor-pointer rounded-sm",
            isHighlighted && "bg-yellow-200/50 dark:bg-yellow-800/30",
            isSearchMatch && !isHighlighted && "bg-orange-100/50 dark:bg-orange-900/30",
          )}
          style={indentStyle}
          onMouseDown={handleMouseDown}
        >
          <span className="w-4" />
          {keyName !== undefined && (
            <>
              <HighlightedText text={keyName} query={searchQuery} className="text-foreground" />
              <span className="text-muted-foreground">:&nbsp;</span>
            </>
          )}
          {renderValue()}
        </div>
      </JsonNodeContextMenu>
    );
  }

  const entries =
    type === "array"
      ? (value as unknown[]).map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>);

  const preview = getPreview(value);
  const bracketOpen = type === "array" ? "[" : "{";
  const bracketClose = type === "array" ? "]" : "}";

  return (
    <div>
      <JsonNodeContextMenu value={value} path={path} keyName={keyName}>
        <div
          ref={nodeRef}
          className={cn(
            "flex items-center py-0.5 hover:bg-accent/30 cursor-pointer rounded-sm",
            isHighlighted && "bg-yellow-200/50 dark:bg-yellow-800/30",
            isSearchMatch && !isHighlighted && "bg-orange-100/50 dark:bg-orange-900/30",
          )}
          style={indentStyle}
          onMouseDown={handleMouseDown}
        >
          <button
            className="flex w-4 shrink-0 items-center justify-center"
            onMouseDown={handleToggle}
            type="button"
          >
            {isExpanded ? (
              <ChevronDown className="size-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3 text-muted-foreground" />
            )}
          </button>
          {keyName !== undefined && (
            <>
              <HighlightedText text={keyName} query={searchQuery} className="text-foreground" />
              <span className="text-muted-foreground">:&nbsp;</span>
            </>
          )}
          {!isExpanded && <span className="text-muted-foreground">{preview}</span>}
          {isExpanded && <span className="text-muted-foreground">{bracketOpen}</span>}
        </div>
      </JsonNodeContextMenu>
      {isExpanded && (
        <>
          {entries.map(([key, val]) => (
            <JsonNode
              key={key}
              value={val}
              path={`${path}.${key}`}
              keyName={key}
              depth={depth + 1}
              highlightPath={highlightPath}
              searchQuery={searchQuery}
              matchingPaths={matchingPaths}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onPathChange={onPathChange}
            />
          ))}
          <div style={indentStyle} className="py-0.5">
            <span className="w-4 inline-block" />
            <span className="text-muted-foreground">{bracketClose}</span>
          </div>
        </>
      )}
    </div>
  );
}

// Helper to expand all paths to a given node
function getPathsToExpand(targetPath: string): string[] {
  const parts = targetPath.split(".");
  const paths: string[] = [];
  for (let i = 1; i <= parts.length; i++) {
    paths.push(parts.slice(0, i).join("."));
  }
  return paths;
}

// Find all paths that match the search query (exported for use by parent components)
export function findMatchingPaths(data: unknown, query: string, path = "root"): string[] {
  if (!query) return [];

  const matches: string[] = [];
  const lowerQuery = query.toLowerCase();

  const checkMatch = (text: string) => text.toLowerCase().includes(lowerQuery);

  if (data === null || data === undefined) {
    return matches;
  }

  if (typeof data === "object" && !Array.isArray(data)) {
    for (const [key, val] of Object.entries(data)) {
      const childPath = `${path}.${key}`;

      // Check if key matches
      if (checkMatch(key)) {
        matches.push(childPath);
      }

      // Check primitive values
      if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        if (checkMatch(String(val))) {
          matches.push(childPath);
        }
      }

      // Recurse into nested objects/arrays
      if (typeof val === "object" && val !== null) {
        matches.push(...findMatchingPaths(val, query, childPath));
      }
    }
  } else if (Array.isArray(data)) {
    for (const [index, val] of data.entries()) {
      const childPath = `${path}.${index}`;

      // Check primitive values
      if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        if (checkMatch(String(val))) {
          matches.push(childPath);
        }
      }

      // Recurse into nested objects/arrays
      if (typeof val === "object" && val !== null) {
        matches.push(...findMatchingPaths(val, query, childPath));
      }
    }
  }

  return matches;
}

export function JsonTreeViewer({
  data,
  highlightPath,
  searchQuery = "",
  onPathChange,
}: JsonTreeViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(["root"]));

  // Find matching paths for search
  const matchingPaths = useMemo(() => {
    if (!searchQuery) return new Set<string>();
    return new Set(findMatchingPaths(data, searchQuery));
  }, [data, searchQuery]);

  // When highlight path changes, ensure all parent paths are expanded
  useEffect(() => {
    if (highlightPath) {
      const pathsToExpand = getPathsToExpand(highlightPath);
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        for (const p of pathsToExpand) {
          next.add(p);
        }
        return next;
      });
    }
  }, [highlightPath]);

  // When search query changes, expand all paths to matching nodes
  useEffect(() => {
    if (matchingPaths.size > 0) {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        for (const matchPath of matchingPaths) {
          const pathsToExpand = getPathsToExpand(matchPath);
          for (const p of pathsToExpand) {
            next.add(p);
          }
        }
        return next;
      });
    }
  }, [matchingPaths]);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return (
    <div className="font-mono text-xs leading-relaxed">
      <JsonNode
        value={data}
        path="root"
        depth={0}
        highlightPath={highlightPath ?? null}
        searchQuery={searchQuery}
        matchingPaths={matchingPaths}
        expandedPaths={expandedPaths}
        onToggle={handleToggle}
        onPathChange={onPathChange}
      />
    </div>
  );
}

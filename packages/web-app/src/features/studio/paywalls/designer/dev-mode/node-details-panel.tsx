"use client";

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { cn, ScrollArea } from "@voidhash/ui";
import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { MimicPreviewRenderer } from "./mimic-preview-renderer";

// Collapsible Section component
function Section({
  title,
  children,
  defaultExpanded = true,
}: {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-3">
      <div
        className="mb-2 flex cursor-pointer items-center gap-1.5 border-border border-b pb-1 font-medium text-muted-foreground text-xs hover:text-foreground"
        onMouseDown={() => setIsExpanded(!isExpanded)}
      >
        <ChevronRightIcon
          className={cn("size-3 transition-transform", isExpanded && "rotate-90")}
        />
        <span>{title}</span>
      </div>
      {isExpanded && <div className="space-y-px">{children}</div>}
    </div>
  );
}

interface NodeDetailsPanelProps {
  node: SnapshotNode | null;
}

// Color swatch for color values
function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="mr-1 inline-block size-3 shrink-0 rounded-sm border border-border/60"
      style={{ backgroundColor: color }}
    />
  );
}

// Check if a value looks like a color
function isColorValue(value: unknown): string | null {
  if (typeof value === "string") {
    if (value.startsWith("#") || value.startsWith("rgb") || value.startsWith("hsl")) {
      return value;
    }
  }
  return null;
}

// Format value for display
function formatValue(value: unknown): React.ReactNode {
  if (value === undefined) return <span className="text-gray-500">-</span>;
  if (value === null) return <span className="text-gray-500">null</span>;

  // Handle color values
  const colorStr = isColorValue(value);
  if (colorStr) {
    return (
      <>
        <ColorSwatch color={colorStr} />
        <span>{colorStr}</span>
      </>
    );
  }

  // Handle objects with value/unit
  if (typeof value === "object" && value !== null && "value" in value) {
    const obj = value as { value?: number; unit?: string };
    return (
      <span>
        {obj.value}
        {obj.unit ?? ""}
      </span>
    );
  }

  // Handle other objects
  if (typeof value === "object") {
    return <span className="text-gray-500">{JSON.stringify(value)}</span>;
  }

  // Handle primitives
  if (typeof value === "string") {
    return <span>{value}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-blue-400">{value}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-purple-400">{String(value)}</span>;
  }

  if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") {
    return <span>{value.toString()}</span>;
  }
  return <span>{JSON.stringify(value)}</span>;
}

// Property row with expandable support
function PropertyRow({
  name,
  value,
  expandable = false,
}: {
  name: string;
  value: unknown;
  expandable?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isObject = typeof value === "object" && value !== null && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const canExpand = expandable && (isObject || isArray);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-px font-mono text-[11px]",
          canExpand && "cursor-pointer hover:bg-accent/30",
        )}
        onMouseDown={canExpand ? () => setIsExpanded(!isExpanded) : undefined}
      >
        {canExpand ? (
          <ChevronRightIcon
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform",
              isExpanded && "rotate-90",
            )}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="shrink-0 text-purple-400">{name}</span>
        <span className="text-muted-foreground">:</span>
        <span className="ml-1 truncate">{formatValue(value)}</span>
      </div>
      {canExpand && isExpanded && (
        <div className="ml-4 border-border/60 border-l pl-2">
          {isArray
            ? (value as unknown[]).map((v, i) => (
                <PropertyRow key={i} name={String(i)} value={v} expandable />
              ))
            : Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                <PropertyRow key={k} name={k} value={v} expandable />
              ))}
        </div>
      )}
    </div>
  );
}

// Get basic node properties for display
function getBasicProperties(node: SnapshotNode): Array<[string, unknown]> {
  const props: Array<[string, unknown]> = [];

  props.push(["id", node.id]);
  props.push(["type", node.type]);

  if ("name" in node.data && node.data.name) {
    props.push(["name", node.data.name]);
  }

  if (node.type === "text" && node.data.text) {
    props.push(["text", node.data.text]);
  }

  return props;
}

export function NodeDetailsPanel({ node }: NodeDetailsPanelProps) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Select a node to view details
      </div>
    );
  }

  const basicProperties = useMemo(() => getBasicProperties(node), [node]);
  const style: Record<string, unknown> = "style" in node.data ? { ...node.data.style } : {};
  const states =
    "states" in node.data
      ? node.data.states.flatMap((entry) =>
          entry.value === undefined
            ? []
            : [{ condition: entry.value.condition, id: entry.id, name: entry.value.name }],
        )
      : [];
  const localVariables =
    "localVariables" in node.data
      ? node.data.localVariables.flatMap((entry) =>
          entry.value === undefined
            ? []
            : [{ id: entry.id, name: entry.value.name, value: entry.value.value }],
        )
      : [];
  const linkedVariables =
    "linkedVariables" in node.data
      ? node.data.linkedVariables.flatMap((entry) =>
          entry.value === undefined ? [] : [entry.value],
        )
      : [];

  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        {/* Node Header */}
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-xs">{node.type}</span>
          <span className="font-medium text-sm">
            {("name" in node.data && node.data.name) || node.type}
          </span>
        </div>

        {/* Rendered Preview */}
        <MimicPreviewRenderer node={node} />

        {/* Properties Section */}
        <Section title="Properties">
          {basicProperties.map(([key, value]) => (
            <PropertyRow key={key} name={key} value={value} />
          ))}
        </Section>

        {/* Style Section */}
        <Section title="Style">
          {Object.keys(style).length > 0 ? (
            Object.entries(style).map(([key, value]) => (
              <PropertyRow key={key} name={key} value={value} expandable />
            ))
          ) : (
            <div className="text-muted-foreground text-xs">No styles</div>
          )}
        </Section>

        {/* States Section */}
        <Section title="States">
          {states.length > 0 ? (
            states.map((state) => (
              <PropertyRow
                key={state.id}
                name={state.name}
                value={{ condition: state.condition }}
                expandable
              />
            ))
          ) : (
            <div className="text-muted-foreground text-xs">No states</div>
          )}
        </Section>

        {/* Local Variables Section */}
        <Section title="Local Variables">
          {localVariables.length > 0 ? (
            localVariables.map((variable) => (
              <PropertyRow
                key={variable.id}
                name={variable.name}
                value={variable.value}
                expandable
              />
            ))
          ) : (
            <div className="text-muted-foreground text-xs">No local variables</div>
          )}
        </Section>

        {/* Linked Variables Section */}
        <Section title="Linked Variables">
          {linkedVariables.length > 0 ? (
            linkedVariables.map((variable, index) => (
              <PropertyRow
                key={`${variable.name}-${variable.nodeId}-${index}`}
                name={variable.name}
                value={variable.nodeId}
              />
            ))
          ) : (
            <div className="text-muted-foreground text-xs">No linked variables</div>
          )}
        </Section>
      </div>
    </ScrollArea>
  );
}

// Helper function to find a node by ID in the snapshot tree
export function findNodeById(node: SnapshotNode, targetId: string): SnapshotNode | null {
  if (node.id === targetId) {
    return node;
  }

  for (const child of node.children) {
    const found = findNodeById(child, targetId);
    if (found) return found;
  }

  return null;
}

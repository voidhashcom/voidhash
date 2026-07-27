import type {
  CodeComponentNodeData,
  ComponentNodeData,
  LibraryNodeData,
  NodeType as SchemaNodeType,
  PathNodeData,
  RootNodeData,
  ScreenNodeData,
  ScrollViewNodeData,
  ShapeNodeData,
  TextNodeData,
  ViewNodeData,
} from "@voidhash/mimic-schema";

export type NodeType = SchemaNodeType;

/**
 * A single document root in the workspace-engine tree snapshot shape:
 * `{id, type, parentId, pos, data, children}` with all node payload fields
 * nested under `data`. The engine's document snapshot is an array of roots;
 * consumers of this package receive exactly one root (`roots[0]`).
 */
export type SnapshotNode =
  | RootSnapshotNode
  | ScreenSnapshotNode
  | ViewSnapshotNode
  | ScrollViewSnapshotNode
  | TextSnapshotNode
  | ShapeSnapshotNode
  | PathSnapshotNode
  | ComponentSnapshotNode
  | LibrarySnapshotNode
  | CodeComponentSnapshotNode;

export type RootSnapshotNode = Omit<RootNodeData, "children"> & {
  children: readonly SnapshotNode[];
};

export type ScreenSnapshotNode = Omit<ScreenNodeData, "children"> & {
  children: readonly SnapshotNode[];
};

export type ViewSnapshotNode = Omit<ViewNodeData, "children"> & {
  children: readonly SnapshotNode[];
};

export type ScrollViewSnapshotNode = Omit<ScrollViewNodeData, "children"> & {
  children: readonly SnapshotNode[];
};

export type TextSnapshotNode = Omit<TextNodeData, "children"> & {
  children: readonly SnapshotNode[];
};

export type ShapeSnapshotNode = Omit<ShapeNodeData, "children"> & {
  children: readonly SnapshotNode[];
};

export type PathSnapshotNode = Omit<PathNodeData, "children"> & {
  children: readonly SnapshotNode[];
};

/**
 * Snapshot of a `component` node. `ComponentNodeData["children"]` is widened
 * by the recursion-breaking annotation in mimic-schema, so it is replaced
 * with the renderer-side union. Component nodes carry no
 * style/states/localVariables — consumers must narrow before accessing those.
 */
export type ComponentSnapshotNode = Omit<ComponentNodeData, "children"> & {
  children: readonly SnapshotNode[];
};

/**
 * Snapshot of the singleton `library` node — a non-visual container for
 * code-component definitions hung off the root. Never rendered on canvas;
 * present in the union so root-children consumers can narrow it out.
 */
export type LibrarySnapshotNode = Omit<LibraryNodeData, "children"> & {
  children: readonly SnapshotNode[];
};

/** Snapshot of a `codeComponent` definition node (source only, no children). */
export type CodeComponentSnapshotNode = Omit<CodeComponentNodeData, "children"> & {
  children: readonly SnapshotNode[];
};

export type RenderOptions = Record<string, never>;

export interface RenderResult {
  html: string;
}

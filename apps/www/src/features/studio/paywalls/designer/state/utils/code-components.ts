import type {
  CodeComponentSnapshotNode,
  ComponentSnapshotNode,
  SnapshotNode,
} from "@voidhash/paywall-renderer-web-core";

import type {
  CodeComponentCompiled,
  DesignerStoreState,
  LocalComponentArtifact,
} from "../designer-store-state";
import { selectDocumentRoot } from "./document-root";

/**
 * A code-component definition as read from the mimic document library. Its
 * IDENTITY is the canonical document-relative `path` (`components/<basename>.tsx`);
 * `name`/`slug` are gone — display text is derived from the path.
 */
export interface CodeComponentDefinition {
  /** The definition's mimic node id (the key `codeComponents.compiled` uses). */
  id: string;
  /** Canonical document-relative path — the component's identity. */
  path: string;
  source: string;
}

const EMPTY_NODES: readonly SnapshotNode[] = [];

/**
 * The file basename (`<basename>.tsx`) of a canonical document-relative
 * component path (`components/<basename>.tsx`). Returns the input unchanged when
 * it carries no `components/` prefix (defensive).
 */
export function componentFileName(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

/**
 * The human-readable display name for a component path: the title-cased file
 * stem (dropping the `.tsx` extension), e.g. `pricing-option.tsx` →
 * `Pricing Option`. Words split on `-`, `_`, and spaces.
 */
export function componentDisplayName(path: string): string {
  const fileName = componentFileName(path);
  const stem = fileName.endsWith(".tsx") ? fileName.slice(0, -".tsx".length) : fileName;
  const words = stem
    .split(/[-_\s]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.length > 0 ? words.join(" ") : stem;
}

/**
 * Selects the raw `codeComponent` snapshot nodes (the library node's children,
 * or a stable empty array). The returned reference is stable across unrelated
 * store updates — critical, because deriving fresh objects in a `useStore`
 * selector loops React (`useSyncExternalStore` requires a cached snapshot).
 * Map to {@link CodeComponentDefinition}s with `useMemo` in the consumer.
 */
export function selectCodeComponentNodes(
  state: Pick<DesignerStoreState, "mimic">,
): readonly SnapshotNode[] {
  const root = selectDocumentRoot(state);
  const library = root.children.find((child) => child.type === "library");
  return library ? library.children : EMPTY_NODES;
}

/** Maps a `codeComponent` snapshot node to a definition. */
export function toCodeComponentDefinition(node: CodeComponentSnapshotNode): CodeComponentDefinition {
  return { id: node.id, path: node.data.path, source: node.data.source };
}

/** Derives definitions from the (stable) library children. */
export function codeComponentDefinitions(
  nodes: readonly SnapshotNode[],
): CodeComponentDefinition[] {
  return nodes.flatMap((node) =>
    node.type === "codeComponent" ? [toCodeComponentDefinition(node)] : [],
  );
}

/** Whether a component snapshot node references a local definition. */
export function isLocalComponentNode(node: ComponentSnapshotNode): boolean {
  return node.data.componentSource === "local";
}

/**
 * Resolves a local instance's `componentPath` to its code-component definition,
 * or `undefined` when no definition file at that path exists (a broken
 * reference). This is the bridge between an instance (which keys by path) and
 * the compiled-artifact store (which keys by definition node id).
 */
export function definitionForComponentPath(
  state: Pick<DesignerStoreState, "mimic">,
  componentPath: string,
): CodeComponentDefinition | undefined {
  if (componentPath === "") {
    return undefined;
  }
  return codeComponentDefinitions(selectCodeComponentNodes(state)).find(
    (definition) => definition.path === componentPath,
  );
}

/**
 * Reads the compiled artifact for a local instance's `componentPath`, if the
 * referenced definition exists and has compiled. Resolves the path → definition
 * id → compiled entry in one step.
 */
export function localArtifactForComponentPath(
  state: Pick<DesignerStoreState, "mimic" | "codeComponents">,
  componentPath: string,
): LocalComponentArtifact | undefined {
  const definition = definitionForComponentPath(state, componentPath);
  return definition ? state.codeComponents.compiled[definition.id]?.artifact : undefined;
}

/** Reads the compiled state for a definition id (undefined when never compiled). */
export function selectCodeComponentCompiled(
  id: string,
): (state: Pick<DesignerStoreState, "codeComponents">) => CodeComponentCompiled | undefined {
  return (state) => state.codeComponents.compiled[id];
}

/** Reads the compiled artifact for a definition id, if ready. */
export function selectLocalComponentArtifact(
  id: string,
): (state: Pick<DesignerStoreState, "codeComponents">) => LocalComponentArtifact | undefined {
  return (state) => state.codeComponents.compiled[id]?.artifact;
}

import { canBeChildOf } from "@voidhash/mimic-schema";
import { getBuiltinComponent } from "@voidhash/paywall-builtins";

import type { ComponentCatalogByContentHash } from "../designer-store-state";

/**
 * Minimal snapshot-node shape the slot gate needs. Snapshot nodes nest their
 * payload under `data`, so component nodes carry `data.contentHash`.
 */
export interface SlotGateNode {
  type: string;
  data?: Record<string, unknown>;
  children?: unknown;
}

/**
 * Manifest slot gate for a component node identified by its pinned
 * contentHash: children are allowed unless the mirrored manifest declares
 * `slot: false`. A missing manifest (hash not in the catalog mirror, or no
 * hash at all) allows children — the flag is a best-effort heuristic and must
 * never block on missing data.
 */
export function canComponentNodeAcceptChildren(
  nodeContentHash: string | undefined,
  byContentHash: ComponentCatalogByContentHash,
): boolean {
  if (nodeContentHash === undefined) {
    return true;
  }
  const entry = byContentHash[nodeContentHash];
  if (!entry) {
    return true;
  }
  return entry.manifest.slot !== false;
}

/**
 * Combined per-node slot gate: non-component nodes always pass; builtin
 * component nodes resolve their manifest by slug from the builtin registry;
 * other component nodes pass {@link canComponentNodeAcceptChildren} for their
 * pinned hash.
 */
export function nodePassesSlotGate(
  node: SlotGateNode | null | undefined,
  byContentHash: ComponentCatalogByContentHash,
): boolean {
  if (!node || node.type !== "component") {
    return true;
  }
  if (node.data?.["componentSource"] === "builtin") {
    const slug = typeof node.data["componentSlug"] === "string" ? node.data["componentSlug"] : "";
    const definition = getBuiltinComponent(slug);
    return definition === undefined || definition.manifest.slot !== false;
  }
  const contentHash =
    typeof node.data?.["contentHash"] === "string" ? node.data["contentHash"] : undefined;
  return canComponentNodeAcceptChildren(contentHash, byContentHash);
}

interface InsertionSnapshotNode extends SlotGateNode {
  id: string;
  children?: readonly InsertionSnapshotNode[];
}

/**
 * Finds the nearest valid parent for inserting a node of `childType`: starts
 * at the first selected node and walks up until a node both accepts
 * `childType` children (schema containment rules via {@link canBeChildOf})
 * and passes the component manifest slot gate (which only affects `component`
 * ancestors — every other node type passes unconditionally). Falls back to
 * the first screen when no selection chain qualifies and a screen is a valid
 * parent for `childType`.
 *
 * Generalizes the original component-only resolver: a `text`, `view`,
 * `scrollView`, or `component` insertion each resolves against its own
 * containment rules while the `component` slot gating is preserved exactly.
 */
export function findInsertionParent(
  snapshot: InsertionSnapshotNode | null,
  childType: string,
  selectedNodeIds: readonly string[],
  byContentHash: ComponentCatalogByContentHash,
): string | null {
  if (!snapshot) {
    return null;
  }

  const parentById = new Map<string, InsertionSnapshotNode | null>();
  const nodeById = new Map<string, InsertionSnapshotNode>();
  const collect = (node: InsertionSnapshotNode, parent: InsertionSnapshotNode | null): void => {
    nodeById.set(node.id, node);
    parentById.set(node.id, parent);
    for (const child of node.children ?? []) {
      collect(child, node);
    }
  };
  collect(snapshot, null);

  const firstSelectedId = selectedNodeIds[0];
  if (firstSelectedId !== undefined) {
    let current = nodeById.get(firstSelectedId) ?? null;
    while (current) {
      if (canBeChildOf(childType, current.type) && nodePassesSlotGate(current, byContentHash)) {
        return current.id;
      }
      current = parentById.get(current.id) ?? null;
    }
  }

  if (!canBeChildOf(childType, "screen")) {
    return null;
  }

  const findFirstScreen = (node: InsertionSnapshotNode): string | null => {
    if (node.type === "screen") {
      return node.id;
    }
    for (const child of node.children ?? []) {
      const found = findFirstScreen(child);
      if (found) {
        return found;
      }
    }
    return null;
  };
  return findFirstScreen(snapshot);
}

/**
 * Component-specialized {@link findInsertionParent} — preserves the original
 * signature/behavior for the `component` insertion path (catalog, local, and
 * builtin instances all insert as `component` nodes).
 */
export function findComponentInsertionParent(
  snapshot: InsertionSnapshotNode | null,
  selectedNodeIds: readonly string[],
  byContentHash: ComponentCatalogByContentHash,
): string | null {
  return findInsertionParent(snapshot, "component", selectedNodeIds, byContentHash);
}

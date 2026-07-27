import type { VariableValue } from "./snapshot-types";
import type { SnapshotNode } from "./types";

export type VariableStore = Map<string, VariableValue>;

/**
 * Read-only variable lookup accepted by the evaluator, state resolver and
 * action executor. A plain {@link VariableStore} satisfies it; chain-aware
 * consumers pass {@link createChainVariableReader} output instead.
 */
export type VariableReader = Pick<VariableStore, "get">;

/** Bidirectional map between array entry IDs and variable internal IDs. */
export type VariableAliases = Map<string, string>;

export interface VariableCollection {
  store: VariableStore;
  aliases: VariableAliases;
}

/** Per-node variable data returned by `collectVariables`. */
export type NodeVariableMap = Map<string, VariableCollection>;

/**
 * Collects all variables from the snapshot tree, scoped by node ID.
 *
 * Each node with `localVariables` gets its own `VariableStore` and `VariableAliases`.
 * This prevents collisions when a node is duplicated (copied nodes share the same
 * internal variable IDs but have different node IDs).
 */
export function collectVariables(root: SnapshotNode): NodeVariableMap {
  const map: NodeVariableMap = new Map();
  collectFromNode(root, map);
  return map;
}

/**
 * Per-node variable stores plus parent links for ancestor-scoped (lexical)
 * resolution. A variable declared on a node is visible to that node and all
 * of its descendants; internal variable ids are not globally unique, so
 * lookups must walk the ancestor chain instead of flat-merging stores.
 */
export interface VariableScopes {
  stores: NodeVariableMap;
  parents: Map<string, string | null>;
}

/**
 * Collects per-node variable stores (same shape as {@link collectVariables})
 * together with parent links for every node in the snapshot tree.
 */
export function collectVariableScopes(root: SnapshotNode): VariableScopes {
  const scopes: VariableScopes = { stores: new Map(), parents: new Map() };
  collectScopesFromNode(root, null, scopes);
  return scopes;
}

function collectScopesFromNode(
  node: SnapshotNode,
  parentId: string | null,
  scopes: VariableScopes,
): void {
  scopes.parents.set(node.id, parentId);
  collectFromNode(node, scopes.stores);
  for (const child of node.children) {
    collectScopesFromNode(child, node.id, scopes);
  }
}

/**
 * Finds the nearest node in the ancestor chain (own node first, then nearest
 * ancestor first) whose store declares `variableId`. This is the node a
 * `set-variable` write must target.
 */
export function findDeclaringNodeInChain(
  parents: ReadonlyMap<string, string | null>,
  getStore: (nodeId: string) => VariableStore | undefined,
  nodeId: string,
  variableId: string,
): string | undefined {
  const visited = new Set<string>();
  let current: string | null = nodeId;
  while (current !== null && !visited.has(current)) {
    visited.add(current);
    if (getStore(current)?.has(variableId)) {
      return current;
    }
    current = parents.get(current) ?? null;
  }
  return undefined;
}

/**
 * Creates a {@link VariableReader} that resolves ids through the ancestor
 * chain of `nodeId` (own store first, then nearest ancestor first). `getStore`
 * is read lazily on every lookup, so live store snapshots (e.g. renderer
 * state) stay current.
 */
export function createChainVariableReader(
  parents: ReadonlyMap<string, string | null>,
  getStore: (nodeId: string) => VariableStore | undefined,
  nodeId: string,
): VariableReader {
  return {
    get: (variableId: string) => {
      const declaringNodeId = findDeclaringNodeInChain(parents, getStore, nodeId, variableId);
      if (declaringNodeId === undefined) {
        return undefined;
      }
      return getStore(declaringNodeId)?.get(variableId);
    },
  };
}

function collectFromNode(node: SnapshotNode, map: NodeVariableMap): void {
  // Unknown-type nodes from newer payloads may carry no data at all.
  const data = node.data;
  if (data !== undefined && "localVariables" in data && data.localVariables.length > 0) {
    const store: VariableStore = new Map();
    const aliases: VariableAliases = new Map();
    for (const entry of data.localVariables) {
      const variable = entry.value;
      if (variable?.id === undefined || variable.value === undefined) {
        continue;
      }
      store.set(variable.id, variable.value);
      store.set(entry.id, variable.value);
      aliases.set(entry.id, variable.id);
      aliases.set(variable.id, entry.id);
    }
    if (store.size > 0) {
      map.set(node.id, { store, aliases });
    }
  }
  for (const child of node.children) {
    collectFromNode(child, map);
  }
}

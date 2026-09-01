import type { VariableValue } from "./snapshot-types";
import type { SnapshotNode } from "./types";

/** A small mutable compatibility surface for renderer variable maps. */
export class VariableMap<K, V> implements Iterable<readonly [K, V]> {
  private readonly values: Map<K, V>;

  constructor(entries: Iterable<readonly [K, V]> = []) {
    this.values = new Map(entries);
  }

  get(key: K) {
    return this.values.get(key);
  }

  has(key: K): boolean {
    return this.values.has(key);
  }

  set(key: K, value: V): this {
    this.values.set(key, value);
    return this;
  }

  get size(): number {
    return this.values.size;
  }

  [Symbol.iterator](): Iterator<readonly [K, V]> {
    return this.values[Symbol.iterator]();
  }
}

export class VariableStore extends VariableMap<string, VariableValue> {}

/** Read-only variable lookup accepted by evaluators and action execution. */
export type VariableReader = Pick<VariableStore, "get">;

/** Bidirectional map between array entry IDs and variable internal IDs. */
export class VariableAliases extends VariableMap<string, string> {}

export interface VariableCollection {
  store: VariableStore;
  aliases: VariableAliases;
}

/** Per-node variable data returned by `collectVariables`. */
export class NodeVariableMap extends VariableMap<string, VariableCollection> {}

/** Collect variables from the snapshot tree, scoped by node ID. */
export function collectVariables(root: SnapshotNode): NodeVariableMap {
  const variables = new NodeVariableMap();
  collectFromNode(root, variables);
  return variables;
}

/** Per-node variable stores plus parent links for lexical resolution. */
export interface VariableScopes {
  stores: NodeVariableMap;
  parents: VariableMap<string, string | undefined>;
}

/** Collect variable stores and parent links for every snapshot node. */
export function collectVariableScopes(root: SnapshotNode): VariableScopes {
  const scopes: VariableScopes = { stores: new NodeVariableMap(), parents: new VariableMap() };
  collectScopesFromNode(root, undefined, scopes);
  return scopes;
}

function collectScopesFromNode(
  node: SnapshotNode,
  parentId: string | undefined,
  scopes: VariableScopes,
): void {
  scopes.parents.set(node.id, parentId);
  collectFromNode(node, scopes.stores, false);
  node.children.forEach((child) => collectScopesFromNode(child, node.id, scopes));
}

/** Find the nearest ancestor store that declares a variable. */
export function findDeclaringNodeInChain(
  parents: VariableMap<string, string | undefined>,
  getStore: (nodeId: string) => ReturnType<VariableMap<string, VariableStore>["get"]>,
  nodeId: string,
  variableId: string,
) {
  const visited = new Set<string>();
  let current: string | undefined = nodeId;
  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    if (getStore(current)?.has(variableId)) return current;
    current = parents.get(current);
  }
  return undefined;
}

/** Create a reader that resolves variables through a node's ancestor chain. */
export function createChainVariableReader(
  parents: VariableMap<string, string | undefined>,
  getStore: (nodeId: string) => ReturnType<VariableMap<string, VariableStore>["get"]>,
  nodeId: string,
): VariableReader {
  return {
    get: (variableId) => {
      const declaringNodeId = findDeclaringNodeInChain(parents, getStore, nodeId, variableId);
      return declaringNodeId === undefined ? undefined : getStore(declaringNodeId)?.get(variableId);
    },
  };
}

function collectFromNode(node: SnapshotNode, map: NodeVariableMap, descend = true): void {
  const data = node.data;
  if (data !== undefined && "localVariables" in data) {
    const collection = data.localVariables.reduce<VariableCollection>(
      (current, entry) => {
        const variable = entry.value;
        if (variable?.id === undefined || variable.value === undefined) return current;
        current.store.set(variable.id, variable.value).set(entry.id, variable.value);
        current.aliases.set(entry.id, variable.id).set(variable.id, entry.id);
        return current;
      },
      { store: new VariableStore(), aliases: new VariableAliases() },
    );
    if (collection.store.size > 0) map.set(node.id, collection);
  }
  if (descend) node.children.forEach((child) => collectFromNode(child, map));
}

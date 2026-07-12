import type { Variable, VariableType } from "@voidhash/mimic-schema";

/**
 * A flat variable resolved through the lexical ancestor chain, annotated with
 * the node that declares it. `id` is the array-entry id (the
 * `toFlatVariables` convention); `aliasId` carries the variable struct's
 * internal id when it differs — stored references may use either.
 */
export interface OwnedVariable extends Variable {
  readonly ownerNodeId: string;
  readonly ownerName: string;
  readonly aliasId?: string;
}

/**
 * Structural view of designer snapshot nodes carrying just the fields the
 * ancestor-variable walk reads. Snapshot nodes nest their payload under
 * `data`, so `name`/`localVariables` sit on `node.data`.
 *
 * The extra optional `path`/`source` keys keep this from being a "weak type":
 * a `codeComponent`'s data is `{path, source}` (no `name`/`localVariables`), so
 * without a shared property TS rejects the whole `RootSnapshotNode` here.
 */
export interface AncestorVariablesSnapshotNode {
  id: string;
  type: string;
  data?: {
    readonly name?: string;
    readonly localVariables?: unknown;
    readonly path?: string;
    readonly source?: string;
  };
  children?: readonly AncestorVariablesSnapshotNode[];
}

function asVariableType(raw: unknown): VariableType | undefined {
  if (!(raw && typeof raw === "object")) {
    return undefined;
  }
  const key = (raw as { key?: unknown }).key;
  const value = (raw as { value?: unknown }).value;
  switch (key) {
    case "string":
      return typeof value === "string" ? { key, value } : undefined;
    case "number":
      return typeof value === "number" ? { key, value } : undefined;
    case "boolean":
      return typeof value === "boolean" ? { key, value } : undefined;
    case "product": {
      if (!(value && typeof value === "object")) {
        return undefined;
      }
      const productId = (value as { productId?: unknown }).productId;
      if (typeof productId === "string") {
        return { key, value: { productId } };
      }
      // null (legacy stored shape) and absence both mean "no product selected".
      if (productId === null || productId === undefined) {
        return { key, value: {} };
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

function collectNodeVariables(node: AncestorVariablesSnapshotNode, into: OwnedVariable[]): void {
  const localVariables = node.data?.localVariables;
  if (!Array.isArray(localVariables)) {
    return;
  }
  const name = node.data?.name;
  const ownerName = typeof name === "string" && name.length > 0 ? name : node.type;

  for (const entry of localVariables) {
    if (!(entry && typeof entry === "object")) {
      continue;
    }
    const entryId = (entry as { id?: unknown }).id;
    const value = (entry as { value?: unknown }).value;
    if (typeof entryId !== "string" || !(value && typeof value === "object")) {
      continue;
    }
    const name = (value as { name?: unknown }).name;
    const variableValue = asVariableType((value as { value?: unknown }).value);
    if (typeof name !== "string" || variableValue === undefined) {
      continue;
    }
    const internalId = (value as { id?: unknown }).id;
    const variable: OwnedVariable = {
      id: entryId,
      name,
      ownerName,
      ownerNodeId: node.id,
      value: variableValue,
    };
    if (typeof internalId === "string" && internalId !== entryId) {
      into.push({ ...variable, aliasId: internalId });
    } else {
      into.push(variable);
    }
  }
}

/**
 * Collects the flat variables visible to `nodeId` under lexical (subtree)
 * scoping: the node's own variables first, then each ancestor's up to the
 * root (nearest first). Returns an empty list when the node is not in the
 * snapshot.
 */
export function collectAncestorVariables(
  snapshot: AncestorVariablesSnapshotNode | null,
  nodeId: string,
): readonly OwnedVariable[] {
  if (!snapshot) {
    return [];
  }

  const chain: AncestorVariablesSnapshotNode[] = [];
  const walk = (node: AncestorVariablesSnapshotNode): boolean => {
    chain.push(node);
    if (node.id === nodeId) {
      return true;
    }
    for (const child of node.children ?? []) {
      if (walk(child)) {
        return true;
      }
    }
    chain.pop();
    return false;
  };

  if (!walk(snapshot)) {
    return [];
  }

  const result: OwnedVariable[] = [];
  for (let i = chain.length - 1; i >= 0; i--) {
    collectNodeVariables(chain[i]!, result);
  }
  return result;
}

/**
 * Maps owned variables to the labeled shape variable pickers render: the
 * owner label is attached only for variables owned by a node other than
 * `selfNodeId`, so self-owned rendering stays unchanged.
 */
export function toLabeledVariables(
  variables: readonly OwnedVariable[],
  selfNodeId: string,
): readonly (Variable & { ownerLabel?: string; aliasId?: string })[] {
  return variables.map((variable) => ({
    aliasId: variable.aliasId,
    id: variable.id,
    name: variable.name,
    ownerLabel: variable.ownerNodeId === selfNodeId ? undefined : variable.ownerName,
    value: variable.value,
  }));
}

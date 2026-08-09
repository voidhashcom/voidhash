import {
  HiddenTreeRootId,
  cloneValue,
  objectValue,
  stringValue,
  treeValue,
  type ObjectValue,
  type Path,
  type TreeNode,
  type TreeValue,
  type Value,
} from "../core/types.ts";
import { createGenerator } from "../fractional/index.ts";
import type { ObjectSchema, TreeSchema } from "../schema/types.ts";
import {
  getNeighborPositionsForInsert,
  getOrderedTreeChildren,
  getTreeAtPath,
  getTreeNodeById,
  isTreeDescendant,
  normalizeIndex,
  treeNodePath,
} from "./path.ts";
import {
  PrimitiveError,
  type CommandSession,
  type InferProxy,
  type InferSnapshot,
  type MaybeUndefined,
  type PrimitiveWithOptionalEncoding,
  shortId,
} from "./shared.ts";
import { type InferUpdateInput } from "./Struct.ts";
import {
  type AnyTreeNodePrimitive,
  type InferTreeNodeChildren,
  type InferTreeNodeData,
  type InferTreeNodeType,
  type TreeChildInsertInput,
  type TreeNodeInput,
} from "./TreeNode.ts";

export interface TreeNodeSnapshot<TNode extends AnyTreeNodePrimitive = AnyTreeNodePrimitive> {
  readonly id: string;
  readonly type: InferTreeNodeType<TNode>;
  readonly parentId: string | null;
  readonly pos: string;
  readonly data: InferSnapshot<InferTreeNodeData<TNode>>;
  readonly children: readonly TreeNodeSnapshot<InferTreeNodeChildren<TNode>>[];
}

type RootInput<TRoot extends AnyTreeNodePrimitive> = readonly TreeNodeInput<TRoot>[];

export interface TypedNodeProxy<TNode extends AnyTreeNodePrimitive> {
  readonly id: string;
  readonly type: InferTreeNodeType<TNode>;
  readonly pos: string;
  readonly parentId: string | null;
  readonly data: InferProxy<InferTreeNodeData<TNode>>;
  readonly children: TreeChildrenProxy<InferTreeNodeChildren<TNode>>;
  get(): TreeNodeSnapshot<TNode> | undefined;
  update(value: InferUpdateInput<InferTreeNodeData<TNode>>): void;
  remove(): void;
  moveTo(target: TreeChildrenProxy<any>, index: number): void;
  moveToPos(targetParentId: string, pos: string): void;
  as<TExpected extends AnyTreeNodePrimitive>(node: TExpected): TypedNodeProxy<TExpected>;
}

export interface TreeChildrenProxy<TAllowed extends AnyTreeNodePrimitive> {
  readonly length: number;
  at(index: number): TypedNodeProxy<TAllowed> | undefined;
  first(): TypedNodeProxy<TAllowed> | undefined;
  last(): TypedNodeProxy<TAllowed> | undefined;
  findById(id: string): TypedNodeProxy<TAllowed> | undefined;
  insertAt(index: number, node: TreeChildInsertInput<TAllowed>): TypedNodeProxy<TAllowed>;
  insertLast(node: TreeChildInsertInput<TAllowed>): TypedNodeProxy<TAllowed>;
  insertAtPos(pos: string, node: TreeChildInsertInput<TAllowed>): TypedNodeProxy<TAllowed>;
  find(
    predicate: (
      node: TypedNodeProxy<TAllowed>,
      index: number,
      collection: readonly TypedNodeProxy<TAllowed>[],
    ) => boolean,
  ): TypedNodeProxy<TAllowed> | undefined;
  findIndex(
    predicate: (
      node: TypedNodeProxy<TAllowed>,
      index: number,
      collection: readonly TypedNodeProxy<TAllowed>[],
    ) => boolean,
  ): number;
  map<TResult>(
    fn: (
      node: TypedNodeProxy<TAllowed>,
      index: number,
      collection: readonly TypedNodeProxy<TAllowed>[],
    ) => TResult,
  ): TResult[];
  filter(
    predicate: (
      node: TypedNodeProxy<TAllowed>,
      index: number,
      collection: readonly TypedNodeProxy<TAllowed>[],
    ) => boolean,
  ): TypedNodeProxy<TAllowed>[];
  some(
    predicate: (
      node: TypedNodeProxy<TAllowed>,
      index: number,
      collection: readonly TypedNodeProxy<TAllowed>[],
    ) => boolean,
  ): boolean;
  every(
    predicate: (
      node: TypedNodeProxy<TAllowed>,
      index: number,
      collection: readonly TypedNodeProxy<TAllowed>[],
    ) => boolean,
  ): boolean;
  forEach(
    fn: (
      node: TypedNodeProxy<TAllowed>,
      index: number,
      collection: readonly TypedNodeProxy<TAllowed>[],
    ) => void,
  ): void;
  [Symbol.iterator](): Iterator<TypedNodeProxy<TAllowed>>;
}

export interface TreeProxy<TRoot extends AnyTreeNodePrimitive> {
  get(): readonly TreeNodeSnapshot<TRoot>[] | undefined;
  set(value: RootInput<TRoot>): void;
  findByIdAcrossTree(id: string): TypedNodeProxy<any> | undefined;
  readonly children: TreeChildrenProxy<TRoot>;
}

interface TreePrimitiveSchema<TRoot extends AnyTreeNodePrimitive> {
  readonly required: boolean;
  readonly defaultValue: RootInput<TRoot> | undefined;
  readonly encodedDefault: TreeValue | undefined;
  readonly root: TRoot;
}

export class TreePrimitive<
  TRoot extends AnyTreeNodePrimitive,
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> implements PrimitiveWithOptionalEncoding<
  RootInput<TRoot> | undefined,
  MaybeUndefined<readonly TreeNodeSnapshot<TRoot>[], TRequired, THasDefault>,
  TreeProxy<TRoot>
> {
  readonly _tag = "TreePrimitive";
  readonly _Input!: RootInput<TRoot> | undefined;
  readonly _Snapshot!: MaybeUndefined<readonly TreeNodeSnapshot<TRoot>[], TRequired, THasDefault>;
  readonly _Proxy!: TreeProxy<TRoot>;

  private readonly state: TreePrimitiveSchema<TRoot>;

  constructor(state: TreePrimitiveSchema<TRoot>) {
    this.state = state;
  }

  get schema(): TreeSchema {
    const variants = buildTreeVariants(this.state.root);
    const base: TreeSchema = {
      kind: "tree",
      discriminator: "type",
      roots: [this.state.root.type],
      variants,
    };
    const encodedDefault = this.state.encodedDefault;
    if (this.state.required && encodedDefault !== undefined) {
      return { ...base, required: true, default: cloneTreeValue(encodedDefault) };
    }
    if (this.state.required) {
      return { ...base, required: true };
    }
    if (encodedDefault !== undefined) {
      return { ...base, default: cloneTreeValue(encodedDefault) };
    }
    return base;
  }

  required(): TreePrimitive<TRoot, true, THasDefault> {
    return new TreePrimitive({
      ...this.state,
      required: true,
    });
  }

  default(defaultValue: RootInput<TRoot>): TreePrimitive<TRoot, TRequired, true> {
    return new TreePrimitive({
      ...this.state,
      defaultValue,
      encodedDefault: this.encodeRoots(defaultValue),
    });
  }

  encode(input: RootInput<TRoot> | undefined): Value {
    const encoded = this.encodeOptional(input);
    if (encoded === undefined) {
      throw new PrimitiveError("Tree value is undefined");
    }
    return encoded;
  }

  encodeOptional(input: unknown): Value | undefined {
    if (input === undefined) {
      if (this.state.encodedDefault !== undefined) {
        return cloneValue(this.state.encodedDefault);
      }
      if (this.state.required) {
        throw new PrimitiveError("Tree value is required");
      }
      return undefined;
    }
    if (!Array.isArray(input)) {
      throw new PrimitiveError("Expected tree root input array");
    }
    return this.encodeRoots(input);
  }

  private encodeRoots(input: RootInput<TRoot>): TreeValue {
    const nodes: TreeNode[] = [];
    const indexByType = collectTreeNodeIndex(this.state.root);
    const ids = new Set<string>([HiddenTreeRootId]);
    let lowerRootPos: string | undefined;
    const generator = createGenerator();

    const visit = (
      nodeInput: TreeNodeInput<AnyTreeNodePrimitive>,
      parent: string,
      allowed: readonly AnyTreeNodePrimitive[],
      lower?: string,
    ): string => {
      const primitive = indexByType.get(nodeInput.type);
      if (!primitive) {
        throw new PrimitiveError(`Unknown tree node type "${nodeInput.type}"`);
      }
      if (!allowed.some((candidate) => candidate.type === primitive.type)) {
        throw new PrimitiveError(`Node type "${nodeInput.type}" is not allowed here`);
      }
      const id = nodeInput.id ?? nextUniqueNodeId(ids);
      if (ids.has(id)) {
        throw new PrimitiveError(`Duplicate tree node id "${id}" in encoded input`);
      }
      ids.add(id);
      const pos = generator.between(lower, undefined);
      nodes.push({
        id,
        parent,
        pos,
        value: encodeTreeNodeObject(primitive, nodeInput),
      });
      let childLower: string | undefined;
      for (const child of nodeInput.children ?? []) {
        childLower = visit(child, id, primitive.children, childLower);
      }
      return pos;
    };

    for (const rootNode of input) {
      lowerRootPos = visit(rootNode, HiddenTreeRootId, [this.state.root], lowerRootPos);
    }

    return treeValue(nodes);
  }

  decode(value: Value | undefined): readonly TreeNodeSnapshot<TRoot>[] | undefined {
    if (value?.kind !== "tree") {
      return undefined;
    }
    const index = collectTreeNodeIndex(this.state.root);
    return buildTreeSnapshots(value, HiddenTreeRootId, index);
  }

  createProxy(session: CommandSession, path: Path): TreeProxy<TRoot> {
    const index = collectTreeNodeIndex(this.state.root);
    return {
      get: () => this.decode(getTreeAtPath(session.current(), path)),
      set: (value) => {
        session.emit([{ kind: "value.set", path, value: this.encode(value) }]);
      },
      findByIdAcrossTree: (id) => {
        const tree = getTreeAtPath(session.current(), path);
        const node = getTreeNodeById(tree, id);
        if (!node) {
          return undefined;
        }
        const typeValue = node.value.fields["type"];
        if (typeValue?.kind !== "string") {
          return undefined;
        }
        const primitive = index.get(typeValue.value);
        if (!primitive) {
          return undefined;
        }
        return createTypedNodeProxy(session, path, index, primitive, id);
      },
      children: createTreeChildrenProxy(session, path, index, HiddenTreeRootId, [this.state.root]),
    };
  }

  optional(stripDefaults: boolean): TreePrimitive<TRoot, false, false> {
    if (stripDefaults) {
      return new TreePrimitive({
        ...this.state,
        required: false,
        defaultValue: undefined,
        encodedDefault: undefined,
      });
    }
    return new TreePrimitive({
      ...this.state,
      required: false,
    });
  }
}

const createTreeChildrenProxy = <TAllowed extends AnyTreeNodePrimitive>(
  session: CommandSession,
  treePath: Path,
  index: Map<string, AnyTreeNodePrimitive>,
  parentId: string,
  allowed: readonly AnyTreeNodePrimitive[],
): TreeChildrenProxy<TAllowed> => {
  const createHandles = (): TypedNodeProxy<TAllowed>[] =>
    getOrderedTreeChildren(getTreeAtPath(session.current(), treePath), parentId)
      .filter((node) => allowed.some((candidate) => candidate.type === readNodeType(node)))
      .map((node) =>
        createTypedNodeProxy<TAllowed>(
          session,
          treePath,
          index,
          index.get(readNodeType(node))!,
          node.id,
        ),
      );

  const proxy: TreeChildrenProxy<TAllowed> & { readonly __parentId: string } = {
    __parentId: parentId,
    get length() {
      return createHandles().length;
    },
    at: (indexValue: number) => {
      const ordered = getOrderedTreeChildren(
        getTreeAtPath(session.current(), treePath),
        parentId,
      ).filter((node) => allowed.some((candidate) => candidate.type === readNodeType(node)));
      const normalized = normalizeIndex(indexValue, ordered.length);
      if (normalized === undefined) {
        return undefined;
      }
      const node = ordered[normalized];
      if (!node) {
        return undefined;
      }
      return createTypedNodeProxy<TAllowed>(
        session,
        treePath,
        index,
        index.get(readNodeType(node))!,
        node.id,
      );
    },
    first: () => proxy.at(0),
    last: () => {
      const handles = createHandles();
      return handles[handles.length - 1];
    },
    findById: (id: string) => {
      const node = getOrderedTreeChildren(
        getTreeAtPath(session.current(), treePath),
        parentId,
      ).find((entry) => entry.id === id);
      if (!node) {
        return undefined;
      }
      const primitive = index.get(readNodeType(node));
      if (!primitive) {
        return undefined;
      }
      return createTypedNodeProxy<TAllowed>(session, treePath, index, primitive, node.id);
    },
    insertAt: (indexValue: number, nodeInput: TreeChildInsertInput<TAllowed>) => {
      const tree = getTreeAtPath(session.current(), treePath);
      const siblings = getOrderedTreeChildren(tree, parentId).filter((node) =>
        allowed.some((candidate) => candidate.type === readNodeType(node)),
      );
      const neighbors = getNeighborPositionsForInsert(
        siblings.map((sibling) => sibling.pos),
        indexValue,
      );
      const primitive = resolveAllowedTreePrimitive(allowed, nodeInput["type"]);
      const id = nodeInput.id ?? session.generator.nextTreeNodeId(treePath);
      const pos = session.generator.between(neighbors.lower, neighbors.upper);
      const node = {
        id,
        parent: parentId,
        pos,
        value: encodeTreeNodeObject(primitive, nodeInput),
      };
      session.emit([{ kind: "tree.insert", path: treePath, node }]);
      return createTypedNodeProxy<TAllowed>(session, treePath, index, primitive, id);
    },
    insertLast: (nodeInput: TreeChildInsertInput<TAllowed>) => {
      const siblings = getOrderedTreeChildren(
        getTreeAtPath(session.current(), treePath),
        parentId,
      ).filter((node) => allowed.some((candidate) => candidate.type === readNodeType(node)));
      return proxy.insertAt(siblings.length, nodeInput);
    },
    insertAtPos: (pos: string, nodeInput: TreeChildInsertInput<TAllowed>) => {
      const primitive = resolveAllowedTreePrimitive(allowed, nodeInput["type"]);
      const id = nodeInput.id ?? session.generator.nextTreeNodeId(treePath);
      const node = {
        id,
        parent: parentId,
        pos,
        value: encodeTreeNodeObject(primitive, nodeInput),
      };
      session.emit([{ kind: "tree.insert", path: treePath, node }]);
      return createTypedNodeProxy<TAllowed>(session, treePath, index, primitive, id);
    },
    find: (predicate: any) => {
      const handles = createHandles();
      return handles.find((node, idx, collection) => predicate(node, idx, collection));
    },
    findIndex: (predicate: any) => {
      const handles = createHandles();
      return handles.findIndex((node, idx, collection) => predicate(node, idx, collection));
    },
    map: (fn: any) => {
      const handles = createHandles();
      return handles.map((node, idx, collection) => fn(node, idx, collection));
    },
    filter: (predicate: any) => {
      const handles = createHandles();
      return handles.filter((node, idx, collection) => predicate(node, idx, collection));
    },
    some: (predicate: any) => {
      const handles = createHandles();
      return handles.some((node, idx, collection) => predicate(node, idx, collection));
    },
    every: (predicate: any) => {
      const handles = createHandles();
      return handles.every((node, idx, collection) => predicate(node, idx, collection));
    },
    forEach: (fn: any) => {
      const handles = createHandles();
      handles.forEach((node, idx, collection) => fn(node, idx, collection));
    },
    [Symbol.iterator]: () => createHandles()[Symbol.iterator](),
  };

  return proxy;
};

/**
 * A tree node primitive resolved from the runtime `type` discriminator.
 *
 * The concrete primitive behind a node id is only known at runtime, so its data, children, and type
 * cannot be tied statically to the node type a caller expects. This alias is the single place that
 * expresses that dynamic relationship, keeping it out of every read site.
 */
type DynamicNodePrimitive = AnyTreeNodePrimitive & {
  readonly type: any;
  readonly data: any;
  readonly children: any;
};

const toParentId = (parent: string): string | null => {
  if (parent === HiddenTreeRootId) {
    return null;
  }
  return parent;
};

const readParentIdMarker = (target: unknown): string | undefined => {
  if (typeof target !== "object" || target === null || !("__parentId" in target)) {
    return undefined;
  }
  const marker = target.__parentId;
  if (typeof marker !== "string") {
    return undefined;
  }
  return marker;
};

const createTypedNodeProxy = <TNode extends AnyTreeNodePrimitive>(
  session: CommandSession,
  treePath: Path,
  index: Map<string, AnyTreeNodePrimitive>,
  primitive: AnyTreeNodePrimitive,
  id: string,
): TypedNodeProxy<TNode> => {
  const getNode = (): TreeNode | undefined =>
    getTreeNodeById(getTreeAtPath(session.current(), treePath), id);

  const getPrimitive = (): DynamicNodePrimitive => {
    const node = getNode();
    if (!node) {
      return primitive;
    }
    return index.get(readNodeType(node)) ?? primitive;
  };

  return {
    get id() {
      return id;
    },
    get type() {
      return getPrimitive().type;
    },
    get pos() {
      return getNode()?.pos ?? "";
    },
    get parentId() {
      const parent = getNode()?.parent;
      if (parent === undefined) {
        return null;
      }
      return toParentId(parent);
    },
    get data() {
      return getPrimitive().data.createProxy(session, treeNodePath(treePath, id));
    },
    get children() {
      return createTreeChildrenProxy(session, treePath, index, id, getPrimitive().children);
    },
    get: () => {
      const node = getNode();
      if (!node) {
        return undefined;
      }
      return buildTreeSnapshot(node, getTreeAtPath(session.current(), treePath)!, index);
    },
    update: (value) => {
      getPrimitive().data.createProxy(session, treeNodePath(treePath, id)).update(value);
    },
    remove: () => {
      session.emit([{ kind: "tree.delete", path: treePath, id }]);
    },
    moveTo: (target, indexValue) => {
      const targetParentId = readParentIdMarker(target);
      if (!targetParentId) {
        throw new PrimitiveError("Target children collection is not movable");
      }
      const tree = getTreeAtPath(session.current(), treePath);
      if (isTreeDescendant(tree, targetParentId, id)) {
        throw new PrimitiveError("Tree move would create a cycle");
      }
      const siblings = getOrderedTreeChildren(tree, targetParentId).filter(
        (node) => node.id !== id,
      );
      const neighbors = getNeighborPositionsForInsert(
        siblings.map((sibling) => sibling.pos),
        indexValue,
      );
      const pos = session.generator.between(neighbors.lower, neighbors.upper);
      session.emit([{ kind: "tree.move", path: treePath, id, parent: targetParentId, pos }]);
    },
    moveToPos: (targetParentId, pos) => {
      const tree = getTreeAtPath(session.current(), treePath);
      if (isTreeDescendant(tree, targetParentId, id)) {
        throw new PrimitiveError("Tree move would create a cycle");
      }
      session.emit([{ kind: "tree.move", path: treePath, id, parent: targetParentId, pos }]);
    },
    as: <TExpected extends AnyTreeNodePrimitive>(nodePrimitive: TExpected) => {
      if (getPrimitive().type !== nodePrimitive.type) {
        throw new PrimitiveError(
          `Expected node type "${nodePrimitive.type}", got "${getPrimitive().type}"`,
        );
      }
      return createTypedNodeProxy<TExpected>(session, treePath, index, nodePrimitive, id);
    },
  };
};

const cloneObjectValue = (value: ObjectValue): ObjectValue => {
  const fields: Record<string, Value> = {};
  for (const [key, field] of Object.entries(value.fields)) {
    fields[key] = cloneValue(field);
  }
  return objectValue(fields);
};

const cloneTreeValue = (value: TreeValue): TreeValue =>
  treeValue(
    value.nodes.map((node) => ({
      id: node.id,
      parent: node.parent,
      pos: node.pos,
      value: cloneObjectValue(node.value),
    })),
  );

const buildTreeVariants = (
  root: AnyTreeNodePrimitive,
): Record<string, { schema: ObjectSchema; children: readonly string[] }> => {
  const nodes = collectTreeNodeIndex(root);
  const variants: Record<string, { schema: ObjectSchema; children: readonly string[] }> = {};
  for (const node of nodes.values()) {
    const schema = node.data.schema;
    if (schema.kind !== "object") {
      throw new PrimitiveError("Tree node data must compile to an object schema");
    }
    variants[node.type] = {
      schema: {
        kind: "object",
        fields: {
          ...schema.fields,
          type: { kind: "literal", value: node.type },
        },
      },
      children: node.children.map((child) => child.type),
    };
  }
  return variants;
};

const collectTreeNodeIndex = (root: AnyTreeNodePrimitive): Map<string, AnyTreeNodePrimitive> => {
  const index = new Map<string, AnyTreeNodePrimitive>();
  const visit = (node: AnyTreeNodePrimitive): void => {
    const existing = index.get(node.type);
    if (existing && existing !== node) {
      throw new PrimitiveError(`Duplicate tree node type "${node.type}"`);
    }
    if (existing) {
      return;
    }
    index.set(node.type, node);
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(root);
  return index;
};

const encodeTreeNodeObject = (
  primitive: DynamicNodePrimitive,
  input: TreeNodeInput<AnyTreeNodePrimitive>,
): ObjectValue => {
  const encoded = primitive.data.encode(input);
  if (encoded.kind !== "object") {
    throw new PrimitiveError("Tree node data must encode to an object");
  }
  return objectValue({
    ...encoded.fields,
    type: stringValue(primitive.type),
  });
};

const readNodeType = (node: TreeNode): string => {
  const typeValue = node.value.fields["type"];
  if (typeValue?.kind !== "string") {
    throw new PrimitiveError(`Tree node "${node.id}" is missing its type discriminator`);
  }
  return typeValue.value;
};

const buildTreeSnapshots = (
  tree: TreeValue,
  parent: string,
  index: Map<string, AnyTreeNodePrimitive>,
): readonly TreeNodeSnapshot<any>[] =>
  getOrderedTreeChildren(tree, parent).map((node) => buildTreeSnapshot(node, tree, index));

const buildTreeSnapshot = (
  node: TreeNode,
  tree: TreeValue,
  index: Map<string, AnyTreeNodePrimitive>,
): TreeNodeSnapshot<any> => {
  const primitive = index.get(readNodeType(node));
  if (!primitive) {
    throw new PrimitiveError(`Unknown tree node type "${readNodeType(node)}"`);
  }
  return {
    id: node.id,
    type: primitive.type,
    parentId: toParentId(node.parent),
    pos: node.pos,
    data: primitive.data.decode(node.value),
    children: buildTreeSnapshots(tree, node.id, index),
  };
};

const resolveAllowedTreePrimitive = (
  allowed: readonly AnyTreeNodePrimitive[],
  type: string,
): AnyTreeNodePrimitive => {
  const primitive = allowed.find((candidate) => candidate.type === type);
  if (!primitive) {
    throw new PrimitiveError(`Tree node type "${type}" is not allowed in this collection`);
  }
  return primitive;
};

export const Tree = <TRoot extends AnyTreeNodePrimitive>(options: {
  root: TRoot;
}): TreePrimitive<TRoot, false, false> =>
  new TreePrimitive({
    required: false,
    defaultValue: undefined,
    encodedDefault: undefined,
    root: options.root,
  });

const nextUniqueNodeId = (existing: Set<string>): string => {
  // Node ids appear in printed composition source, so they are short.
  let id = shortId();
  while (existing.has(id)) {
    id = shortId();
  }
  return id;
};

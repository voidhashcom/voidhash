import type { AnyPrimitive, InferInput } from "./shared.ts";
import type { StructPrimitive } from "./Struct.ts";

const TreeNodeSelfSymbol: unique symbol = Symbol.for("TreeNode.Self");

export interface TreeNodeSelfType {
  readonly _tag: "TreeNodeSelf";
  readonly _brand: typeof TreeNodeSelfSymbol;
}

export const TreeNodeSelf: TreeNodeSelfType = {
  _tag: "TreeNodeSelf",
  _brand: TreeNodeSelfSymbol,
};

const isSelf = (value: unknown): value is TreeNodeSelfType =>
  typeof value === "object" &&
  value !== null &&
  "_brand" in value &&
  value._brand === TreeNodeSelfSymbol;

export type TreeNodeChildrenInput =
  | readonly (AnyTreeNodePrimitive | TreeNodeSelfType)[]
  | (() => readonly (AnyTreeNodePrimitive | TreeNodeSelfType)[]);

export type AnyTreeNodePrimitive = TreeNodePrimitive<
  string,
  StructPrimitive<Record<string, AnyPrimitive>, any, any>,
  AnyTreeNodePrimitive
>;

type ResolveSelf<T, TSelf extends AnyTreeNodePrimitive> = T extends TreeNodeSelfType ? TSelf : T;

type ResolveChildrenUnion<
  TChildren,
  TSelf extends AnyTreeNodePrimitive,
> = TChildren extends readonly (infer U)[] ? ResolveSelf<U, TSelf> : never;

export interface TreeNodeConfig<
  TData extends StructPrimitive<Record<string, AnyPrimitive>, any, any>,
  TChildren extends readonly (AnyTreeNodePrimitive | TreeNodeSelfType)[],
> {
  readonly data: TData;
  readonly children: TChildren | (() => TChildren);
}

const resolveChildrenInput = (
  input: TreeNodeChildrenInput,
): readonly (AnyTreeNodePrimitive | TreeNodeSelfType)[] => {
  if (typeof input === "function") return input();
  return input;
};

export class TreeNodePrimitive<
  TType extends string,
  TData extends StructPrimitive<Record<string, AnyPrimitive>, any, any>,
  TChildren extends AnyTreeNodePrimitive = AnyTreeNodePrimitive,
> {
  readonly _tag = "TreeNodePrimitive";
  readonly _Type!: TType;
  readonly _Data!: TData;
  readonly _Children!: TChildren;
  readonly TSetInput!: TreeNodeInput<TreeNodePrimitive<TType, TData, TChildren>>;

  readonly type: TType;
  readonly data: TData;
  private readonly childrenInput: TreeNodeChildrenInput;
  private resolvedChildren?: readonly AnyTreeNodePrimitive[];

  constructor(type: TType, data: TData, childrenInput: TreeNodeChildrenInput) {
    this.type = type;
    this.data = data;
    this.childrenInput = childrenInput;
  }

  get children(): readonly AnyTreeNodePrimitive[] {
    if (this.resolvedChildren === undefined) {
      this.resolvedChildren = resolveChildrenInput(this.childrenInput).map((child) => {
        if (isSelf(child)) return this;
        return child;
      });
    }
    return this.resolvedChildren;
  }

  isChildAllowed(childType: string): boolean {
    return this.children.some((child) => child.type === childType);
  }
}

export type InferTreeNodeType<T extends AnyTreeNodePrimitive> =
  T extends TreeNodePrimitive<infer TType, any, any> ? TType : never;

export type InferTreeNodeData<T extends AnyTreeNodePrimitive> =
  T extends TreeNodePrimitive<any, infer TData, any> ? TData : never;

export type InferTreeNodeChildren<T extends AnyTreeNodePrimitive> =
  T extends TreeNodePrimitive<any, any, infer TChildren> ? TChildren : never;

export type TreeNodeInput<TNode extends AnyTreeNodePrimitive> = {
  readonly type: InferTreeNodeType<TNode>;
  readonly id?: string;
  readonly children?: readonly TreeNodeInput<InferTreeNodeChildren<TNode>>[];
} & (InferInput<InferTreeNodeData<TNode>> extends undefined
  ? Record<string, never>
  : NonNullable<InferInput<InferTreeNodeData<TNode>>>);

export type TreeChildInsertInput<TAllowed extends AnyTreeNodePrimitive> =
  TAllowed extends AnyTreeNodePrimitive ? TreeNodeInput<TAllowed> : never;

export const TreeNode = <
  TType extends string,
  TData extends StructPrimitive<Record<string, AnyPrimitive>, any, any>,
  const TChildren extends readonly (AnyTreeNodePrimitive | TreeNodeSelfType)[],
>(
  type: TType,
  config: TreeNodeConfig<TData, TChildren>,
): TreeNodePrimitive<
  TType,
  TData,
  ResolveChildrenUnion<TChildren, TreeNodePrimitive<TType, TData, any>>
> =>
  new TreeNodePrimitive<
    TType,
    TData,
    ResolveChildrenUnion<TChildren, TreeNodePrimitive<TType, TData, any>>
  >(type, config.data, config.children);

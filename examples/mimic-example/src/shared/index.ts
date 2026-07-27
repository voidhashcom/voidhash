import { Primitive } from "@voidhash/mimic-core";

export const CardNode = Primitive.TreeNode("card", {
  data: Primitive.Struct({
    title: Primitive.String().min(1).max(34),
    description: Primitive.String(),
    priority: Primitive.Number().min(1).max(3).default(1),
  }),
  children: [Primitive.TreeNodeSelf],
});

export const ColumnNode = Primitive.TreeNode("column", {
  data: Primitive.Struct({
    name: Primitive.String().min(1).max(34),
  }),
  children: [CardNode],
});

export const BoardNode = Primitive.TreeNode("board", {
  data: Primitive.Struct({
    name: Primitive.String().default("My Board").min(1).max(34),
  }),
  children: [ColumnNode],
});

export const MimicExampleSchema = Primitive.Tree({
  root: BoardNode,
});

export type BoardSnapshot = Primitive.TreeNodeSnapshot<typeof BoardNode>;
export type ColumnSnapshot = Primitive.TreeNodeSnapshot<typeof ColumnNode>;
export type CardSnapshot = Primitive.TreeNodeSnapshot<typeof CardNode>;

export const ExamplePresencePrimitive = Primitive.Struct({
  name: Primitive.String(),
}).required();

export type ExamplePresence = Primitive.InferSnapshot<typeof ExamplePresencePrimitive>;

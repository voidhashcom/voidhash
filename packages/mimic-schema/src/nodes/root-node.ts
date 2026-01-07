import { Primitive } from "@voidhash/mimic";

import { ScreenNode } from "./screen-node";

/** RootNode tree node schema - the document root that contains screens */
export const RootNode = Primitive.TreeNode("root", {
  children: [ScreenNode] as const,
  data: Primitive.Struct({
    name: Primitive.String(),
  }),
});

export type RootNodeData = Primitive.TreeNodeSnapshot<typeof RootNode>;

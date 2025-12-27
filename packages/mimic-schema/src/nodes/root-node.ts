import { Primitive } from '@voidhash/mimic';
import { ScreenNode } from './screen-node';

/** RootNode tree node schema - the document root that contains screens */
export const RootNode = Primitive.TreeNode('root', {
  data: Primitive.Struct({}),
  children: () => [ScreenNode] as const
});

export type RootNodeData = Primitive.TypedTreeNodeState<typeof RootNode>;

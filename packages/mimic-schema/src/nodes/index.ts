import type { FlexNodeData } from "./flex-node";
import type { RootNodeData } from "./root-node";
import type { ScreenNodeData } from "./screen-node";
import type { TextNodeData } from "./text-node";

export { linkedVariables, localVariables, states, type Variable } from "./base";
export { FlexNode, type FlexNodeData } from "./flex-node";
export { RootNode, type RootNodeData } from "./root-node";
export { ScreenNode, type ScreenNodeData } from "./screen-node";
export { TextNode, type TextNodeData } from "./text-node";

export type AnyNodeData =
  | ScreenNodeData
  | FlexNodeData
  | TextNodeData
  | RootNodeData;

/**
 * `@voidhash/paywalls/tree` — the Node-only preview-tree renderer.
 *
 * Used by the CLI at build time to SSR component preview states into §3 node
 * trees (`previews/<state>.json`). Depends on `react-reconciler`; never import
 * this entry from browser code (the `.` and `./dom` entries stay
 * reconciler-free).
 */

export {
  PAYWALL_TREE_VERSION,
  type PaywallImageNode,
  type PaywallNode,
  type PaywallNodeResizeMode,
  type PaywallNodeTree,
  type PaywallPlaceholderNode,
  type PaywallPressableNode,
  type PaywallScrollNode,
  type PaywallSlotNode,
  type PaywallTextNode,
  type PaywallViewNode,
} from "./schema/node-tree";
export {
  type RenderToNodeTreeOptions,
  renderToNodeTree,
} from "./tree-renderer/render-to-node-tree";
export {
  TREE_ELEMENT_TYPES,
  treeHostComponents,
} from "./tree-renderer/tree-host";

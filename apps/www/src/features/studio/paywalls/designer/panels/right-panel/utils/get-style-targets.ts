import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useStore } from "zustand/react";

import { usePaywallDesignerStore } from "../../../state/designer-store";
import { selectRenderRoot } from "../../../state/utils/document-root";
import { findNodeById } from "../../../state/utils/tree";
import { getStyleTargetsForNodes, type StyleTargetsResult } from "./style-targets-core";

export { getStyleTargetsForNodes, type StyleTargetsResult };

export function useStyleTargets(nodes: SnapshotNode[]): StyleTargetsResult {
  const store = usePaywallDesignerStore();
  const stateOverrideSelection = useStore(store, (state) => state.stateOverrideSelection);

  // Re-resolve the selected nodes from the draft-aware render root so an
  // in-progress deferred edit (a style-panel drag runs inside a mimic draft)
  // reflects live in the panel's own controls — gradient stop bar, stop
  // position inputs, swatches — matching the canvas. Subscribing to
  // `selectRenderRoot` also re-renders the panel on each draft edit. With no
  // active draft this is the committed snapshot and resolves the same nodes.
  const renderRoot = useStore(store, selectRenderRoot);
  const resolvedNodes = nodes.map(
    (node) => findNodeById<SnapshotNode>(renderRoot, node.id) ?? node,
  );

  return getStyleTargetsForNodes(resolvedNodes, stateOverrideSelection);
}

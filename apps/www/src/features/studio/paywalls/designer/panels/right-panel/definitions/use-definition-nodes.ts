"use client";

/**
 * The one hook every built-in panel definition uses to resolve the nodes it
 * edits from the store. It bridges the two host seams a definition reads —
 * {@link useDefinitionSelection} (the reactive selected node ids) and
 * {@link usePaywallDesignerStore} (the live document) — into a single
 * `{ nodes, style, targets, mixedKeys }` result, so a definition never touches
 * the render root, draft plumbing, or style-target resolution directly.
 *
 * It is the draft-aware analogue of the legacy sections' `useStyleTargets(nodes)`
 * with the `nodes` argument replaced by the selection channel: nodes are
 * resolved from `selectRenderRoot` (draft-staged snapshot preferred, so an
 * in-progress panel drag renders live), then run through the SAME
 * `getStyleTargetsForNodes` core the legacy sections use, keeping behavior
 * byte-identical. Subscribing to `selectRenderRoot` also re-renders the panel on
 * every draft edit; subscribing to the selection store re-renders it on every
 * selection change.
 */
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useStore } from "zustand/react";

import { usePaywallDesignerStore } from "../../../state/designer-store";
import { selectRenderRoot } from "../../../state/utils/document-root";
import { findNodeById } from "../../../state/utils/tree";
import { getStyleTargetsForNodes, type StyleTargetsResult } from "../utils/get-style-targets";
import { useDefinitionSelection } from "./definition-selection";

/**
 * The resolved editing target for a definition: the selected snapshot nodes plus
 * the style-target result (effective `style`, write `targets`, and `mixedKeys`
 * across a multi-selection). `style` is `null` when the first node is styleless
 * — a definition returns `null` in that case, exactly like the legacy sections.
 */
export interface DefinitionNodes extends StyleTargetsResult {
  /** The selected snapshot nodes, resolved draft-aware from the render root. */
  readonly nodes: SnapshotNode[];
}

/**
 * Resolves the current definition's editing target from the store + selection.
 * Reactive: re-renders on selection changes, document changes, and in-progress
 * draft edits.
 */
export function useDefinitionNodes(): DefinitionNodes {
  const store = usePaywallDesignerStore();
  const { nodeIds } = useDefinitionSelection();
  const stateOverrideSelection = useStore(store, (state) => state.stateOverrideSelection);

  // Prefer the active draft's staged snapshot so an in-progress deferred edit
  // (a style-panel drag runs inside a mimic draft) reflects live in the panel's
  // own controls, matching the canvas; with no active draft this is the
  // committed snapshot. Subscribing here also re-renders the panel per draft
  // edit.
  const renderRoot = useStore(store, selectRenderRoot);
  // Resolve each selected id from the render root, DROPPING any that no longer
  // resolve. The legacy `useStyleTargets(nodes)` fell back to the passed-in
  // snapshot node (`findNodeById(...) ?? node`), but there the caller already
  // held a resolved node object; here only the id crosses the selection seam.
  // In the live flow the ids come straight from the current render nodes
  // (`panel-stack` maps `nodes.map(n => n.id)`), so they always resolve and the
  // two paths are identical — the drop only guards a transient stale id, where
  // rendering nothing is safer than rendering stale style data.
  const nodes = nodeIds.flatMap((id) => {
    const node = findNodeById<SnapshotNode>(renderRoot, id);
    return node ? [node] : [];
  });

  const result = getStyleTargetsForNodes(nodes, stateOverrideSelection);
  return { nodes, ...result };
}

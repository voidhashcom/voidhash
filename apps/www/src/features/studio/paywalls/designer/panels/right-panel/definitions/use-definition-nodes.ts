"use client";

/**
 * The one hook every built-in panel definition uses to resolve the nodes it
 * edits from the store. It bridges the two host seams a definition reads —
 * {@link useDefinitionSelection} (the reactive selected node ids) and
 * {@link usePaywallDesignerStore} (the live document) — into a single
 * `{ nodes, style, targets, mixedKeys }` result. Nodes resolve from the
 * draft-aware render root and flow through the shared style-target core, while
 * subscriptions keep the panel current with draft edits and selection changes.
 */
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useStore } from "zustand/react";

import { usePaywallDesignerStore } from "../../../state/designer-store";
import { selectRenderRoot } from "../../../state/utils/document-root";
import { findNodeById } from "../../../state/utils/tree";
import { getStyleTargetsForNodes, type StyleTargetsResult } from "../utils/style-targets-core";
import { useDefinitionSelection } from "./definition-selection";

/**
 * The resolved editing target for a definition: the selected snapshot nodes plus
 * the style-target result (effective `style`, write `targets`, and `mixedKeys`
 * across a multi-selection). `style` is `null` when the first node is styleless.
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
  // Drop transient stale ids rather than rendering controls for stale style data.
  const nodes = nodeIds.flatMap((id) => {
    const node = findNodeById<SnapshotNode>(renderRoot, id);
    return node ? [node] : [];
  });

  const result = getStyleTargetsForNodes(nodes, stateOverrideSelection);
  return { nodes, ...result };
}

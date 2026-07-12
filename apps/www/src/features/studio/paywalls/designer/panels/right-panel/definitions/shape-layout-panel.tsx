"use client";

/**
 * Built-in panel DEFINITION for the shape `Layout` section — the wire-tree
 * replica of {@link ../sections/shape-layout-section.ShapeLayoutSection}
 * (single `shape` node; NO override-reset affordances).
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` "Layout" → `Panel.Section title="Layout"`.
 * - A single `Dimensions` subsection with the same width/height fields as the
 *   flex-layout panel → `Panel.Subsection title="Dimensions"` > `Panel.Row` > two
 *   `Panel.DimensionField`s.
 *
 * Behavior (identical to the old section): the width/height controls behave
 * exactly like the flex panel's (mode derived HERE from the parent flex
 * direction, computed px from the bounding box), but EVERY write goes through
 * `updateShapeNode({ id, updates: { style } })` — the node-level shape action, NOT
 * the generic `updateLayoutStyle`. Typing is a DRAFT gesture (`updateShapeNode`
 * inside an active draft); a menu mode change is a DIRECT write. There are no
 * reset affordances (shapes have no state overrides).
 */
import type { ShapeSnapshotNode, SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import { useCallback } from "react";
import { useStore } from "zustand";

import {
  dimensionModeWrite,
  FALLBACK_FIXED_PX,
  getDimensionState,
  type DimensionAxis,
  type DimensionState,
} from "../../../panel-kit/dimension-field";
import { useDesignerDraft } from "../../../hooks/use-designer-draft";
import { updateShapeNode } from "../../../state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "../../../state/designer-store";
import { getAlignItems, getFlexDirection } from "../../../state/utils/node-type-helpers";
import { getNodeById } from "../../../state/utils/nodes";
import { useDefinitionNodes } from "./use-definition-nodes";

/** The shape flex-sizing style the dimension fields read and write. */
interface ShapeLayoutStyle {
  width: number | "auto";
  height: number | "auto";
  flex: number | undefined;
  alignSelf: "auto" | "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
}

/** The shape `Layout` panel definition. */
export function ShapeLayoutPanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { nodes } = useDefinitionNodes();
  const { draft, begin, commit } = useDesignerDraft(store);

  const firstNode = nodes[0] as SnapshotNode | undefined;
  const shapeNode: ShapeSnapshotNode | undefined =
    firstNode?.type === "shape" ? firstNode : undefined;
  const parentId = shapeNode?.parentId ?? null;
  const nodeId = shapeNode?.id ?? null;

  const parent = useStore(store, (state) => (parentId ? getNodeById(state, parentId) : null));
  const boundingBox = useStore(store, (state) =>
    nodeId ? (state.canvas.boundingBoxes[nodeId] ?? null) : null,
  );

  const handleChange = useCallback(
    (incoming: Partial<ShapeLayoutStyle>) => {
      if (!nodeId) return;
      dispatch(updateShapeNode)({ id: nodeId, updates: { style: incoming } });
    },
    [dispatch, nodeId],
  );

  const handleDraftChange = useCallback(
    (incoming: Partial<ShapeLayoutStyle>) => {
      if (!nodeId) return;
      if (!draft) begin();
      dispatch(updateShapeNode)({ id: nodeId, updates: { style: incoming } });
    },
    [draft, begin, dispatch, nodeId],
  );

  const handleCommit = useCallback(() => {
    commit();
  }, [commit]);

  if (!shapeNode) return <Panel />;

  const style = shapeNode.data.style;
  const node: ShapeLayoutStyle = {
    width: style.width,
    height: style.height,
    flex: style.flex,
    alignSelf: style.alignSelf,
  };
  const parentDirection = parent ? getFlexDirection(parent, "row") : "row";
  const parentAlignItems = getAlignItems(parent, "stretch");
  const computedWidth = boundingBox ? Math.round(boundingBox.width) : null;
  const computedHeight = boundingBox ? Math.round(boundingBox.height) : null;

  const dimension = (axis: DimensionAxis) => {
    const mode = getDimensionState(axis, node as never, parentDirection, parentAlignItems);
    const stored = node[axis];
    const computed = axis === "width" ? computedWidth : computedHeight;
    const value = stored === "auto" ? FALLBACK_FIXED_PX : stored;
    const onModeChange = (next: DimensionState) => {
      const effectivePx = computed ?? (stored === "auto" ? FALLBACK_FIXED_PX : stored);
      handleChange(
        dimensionModeWrite(axis, next, {
          effectivePx,
          parentDirection,
          parentAlignItems,
          currentAlignSelf: node.alignSelf,
        }) as Partial<ShapeLayoutStyle>,
      );
    };
    return { mode, value, computed, onModeChange };
  };

  const width = dimension("width");
  const height = dimension("height");

  return (
    <Panel>
      <Panel.Section title="Layout">
        <Panel.Subsection title="Dimensions">
          <Panel.Row align="stretch">
            <Panel.DimensionField
              axis="width"
              mode={width.mode}
              value={width.value}
              computed={width.computed ?? undefined}
              label="Width"
              onChange={(value) => handleDraftChange({ width: Number(value) })}
              onCommit={handleCommit}
              onModeChange={(mode) => width.onModeChange(mode as DimensionState)}
            />
            <Panel.DimensionField
              axis="height"
              mode={height.mode}
              value={height.value}
              computed={height.computed ?? undefined}
              label="Height"
              onChange={(value) => handleDraftChange({ height: Number(value) })}
              onCommit={handleCommit}
              onModeChange={(mode) => height.onModeChange(mode as DimensionState)}
            />
          </Panel.Row>
        </Panel.Subsection>
      </Panel.Section>
    </Panel>
  );
}

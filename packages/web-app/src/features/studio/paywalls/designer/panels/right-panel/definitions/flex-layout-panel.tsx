"use client";

/**
 * Built-in layout panel definition for screen and view selections.
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` "Layout" → `Panel.Section title="Layout"`.
 * - FLEX subsection: a full-width direction `ToggleGroup` (column/row) + a gap
 *   `TextInput` stacked in a flexible column, beside the fixed-width
 *   `FlexAlignmentInput` → `Panel.Subsection` > `Panel.Row` > (`Panel.Column`
 *   `width="full"` of a `Panel.ToggleGroup` + `Panel.TextField`) +
 *   `Panel.AlignmentGrid`.
 * - DIMENSIONS subsection: two width/height fields → `Panel.Subsection title=
 *   "Dimensions"` > `Panel.Row` > two `Panel.DimensionField`s (axis width/height).
 * - PADDING subsection: uniform (2 fields) OR expanded (4 per-side fields) + an
 *   expand/collapse button → `Panel.Subsection title="Padding"` > `Panel.Row`.
 *
 * The panel renders only when the first node has a parent; otherwise the
 * definition returns an empty `<Panel/>`. Dimension inputs are disabled for a
 * `screen` node (`editableDimensions = firstNode.type !== "screen"`).
 *
 * Behavior (identical to the old section):
 * - direction + alignment are DIRECT writes (one undo); gap + padding + dimension
 *   typing are DRAFT gestures (begin-on-first-change → live write → commit).
 * - DIMENSION mode derivation stays HERE: `getDimensionState` computes fill/hug/
 *   custom from the node's flex sizing + the PARENT's flex direction; the paired
 *   `alignSelf`/`flex`/`width` resets each mode writes are replicated exactly and
 *   go DIRECT via `updateLayoutStyle` (one undo). `computed` px comes from the
 *   canvas bounding box, rounded, like the old `DimensionsSubSection`.
 * - `showIndividualPadding` is a one-time-seeded local `useState` (non-uniform
 *   padding OR any padding key mixed), matching the legacy `key={section.id}`
 *   mount.
 * - Every reset affordance the old section rendered is replicated: flexDirection;
 *   gap; [alignItems, justifyContent]; [width, flex, alignSelf]; [height, flex,
 *   alignSelf]; and the six padding combos.
 *
 * PARITY COMPROMISES (wire limitations, not the section's intent): none — the
 * wire `alignmentGrid`/`dimensionField` composites carry the full host controls,
 * and the padding/gap/direction icon tokens are the exact ones the section drew.
 */
import type { AlignItems, FlexDirection, JustifyContent } from "@voidhash/mimic-schema";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import { useCallback, useState } from "react";
import { useStore } from "zustand";

import {
  dimensionModeWrite,
  FALLBACK_FIXED_PX,
  getDimensionState,
  type DimensionAxis,
  type DimensionState,
} from "../../../panel-kit/dimension-field";
import { useDesignerDraft } from "../../../hooks/use-designer-draft";
import { updateContainerAlignment, updateLayoutStyle } from "../../../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../../state/designer-store";
import { getAlignItems, getFlexDirection } from "../../../state/utils/node-type-helpers";
import { getNodeById } from "../../../state/utils/nodes";
import { useStyleOverrideResetContext } from "../utils/use-style-override-reset-context";
import { useDefinitionNodes } from "./use-definition-nodes";

/** The flex-sizing style the layout panel reads and writes. */
interface LayoutStyle {
  gap: number;
  justifyContent: string;
  alignItems: string;
  flexDirection: FlexDirection;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  width: number | "auto";
  height: number | "auto";
  flex: number | undefined;
  alignSelf: "auto" | "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
}

const DIRECTION_KEYS = ["flexDirection"] as const;
const GAP_KEYS = ["gap"] as const;
const ALIGNMENT_KEYS = ["alignItems", "justifyContent"] as const;
const WIDTH_KEYS = ["width", "flex", "alignSelf"] as const;
const HEIGHT_KEYS = ["height", "flex", "alignSelf"] as const;
const PADDING_LEFT_KEYS = ["paddingLeft"] as const;
const PADDING_TOP_KEYS = ["paddingTop"] as const;
const PADDING_RIGHT_KEYS = ["paddingRight"] as const;
const PADDING_BOTTOM_KEYS = ["paddingBottom"] as const;
const PADDING_HORIZONTAL_KEYS = ["paddingLeft", "paddingRight"] as const;
const PADDING_VERTICAL_KEYS = ["paddingTop", "paddingBottom"] as const;

/** Whether padding diverges (top≠bottom or left≠right) — the expanded seed. */
function shouldShowIndividualPadding(node: LayoutStyle): boolean {
  return node.paddingTop !== node.paddingBottom || node.paddingLeft !== node.paddingRight;
}

/** The `Layout` (flex) panel definition. */
export function FlexLayoutPanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { nodes, style, targets, mixedKeys } = useDefinitionNodes();
  const overrideReset = useStyleOverrideResetContext(nodes);
  const { draft, begin, commit } = useDesignerDraft(store);

  const firstNode = nodes[0] as SnapshotNode | undefined;
  const parentId = firstNode?.parentId ?? null;
  const firstNodeId = firstNode?.id ?? null;
  const editableDimensions = firstNode?.type !== "screen";

  // The parent node (for the parent flex direction) + the first node's live
  // bounding box (for the computed px labels), read draft-agnostic from the store
  // exactly like the legacy `DimensionsSubSection`.
  const parent = useStore(store, (state) => (parentId ? getNodeById(state, parentId) : null));
  const boundingBox = useStore(store, (state) =>
    firstNodeId ? state.canvas.boundingBoxes[firstNodeId] : null,
  );

  const node = style as LayoutStyle | null;

  // One-time seed: expanded when padding is non-uniform or any padding key is
  // mixed across a multi-selection (matches the old `useState(initializer)` under
  // `key={section.id}`).
  const [showIndividualPadding, setShowIndividualPadding] = useState<boolean>(() => {
    if (!node) return false;
    return (
      shouldShowIndividualPadding(node) ||
      mixedKeys.has("paddingLeft") ||
      mixedKeys.has("paddingRight") ||
      mixedKeys.has("paddingTop") ||
      mixedKeys.has("paddingBottom")
    );
  });

  const handleChange = useCallback(
    (incoming: Partial<LayoutStyle>) => {
      dispatch(updateLayoutStyle)({ nodes: targets, style: incoming });
    },
    [dispatch, targets],
  );

  const handleDraftChange = useCallback(
    (incoming: Partial<LayoutStyle>) => {
      if (!draft) begin();
      dispatch(updateLayoutStyle)({ nodes: targets, style: incoming });
    },
    [draft, begin, dispatch, targets],
  );

  const handleCommit = useCallback(() => {
    commit();
  }, [commit]);

  const collapsePadding = useCallback(() => {
    if (!node) return;
    setShowIndividualPadding(false);
    handleChange({
      paddingLeft: node.paddingLeft,
      paddingRight: node.paddingLeft,
      paddingTop: node.paddingTop,
      paddingBottom: node.paddingTop,
    });
  }, [node, handleChange]);

  // Parentless selections have no flex-layout relationship to edit.
  if (!node || !parentId) return <Panel />;

  const parentDirection = getFlexDirection(parent, "row");
  const parentAlignItems = getAlignItems(parent, "stretch");
  const computedWidth = boundingBox ? Math.round(boundingBox.width) : null;
  const computedHeight = boundingBox ? Math.round(boundingBox.height) : null;

  const active = overrideReset.isOverrideModeActive;
  const reset = (keys: readonly string[]) =>
    handleChange(overrideReset.buildResetPatch(keys) as Partial<LayoutStyle>);

  // ── Dimension wiring (mode + display value + paired-reset writes) ────────────
  const dimension = (axis: DimensionAxis) => {
    const mode = getDimensionState(axis, node as never, parentDirection, parentAlignItems);
    const stored = node[axis];
    const computed = axis === "width" ? computedWidth : computedHeight;
    // Numeric value: the stored dimension in `custom`; the effective fallback
    // (auto → FALLBACK_FIXED_PX) otherwise, so the `Fixed … (N px)` menu label
    // matches the monolith even without a bounding box.
    const value = stored === "auto" ? FALLBACK_FIXED_PX : stored;
    const onModeChange = (next: DimensionState) => {
      const effectivePx = computed ?? (stored === "auto" ? FALLBACK_FIXED_PX : stored);
      handleChange(
        dimensionModeWrite(axis, next, {
          effectivePx,
          parentDirection,
          parentAlignItems,
          currentAlignSelf: node.alignSelf,
        }) as Partial<LayoutStyle>,
      );
    };
    return { mode, value, computed, onModeChange };
  };

  const width = dimension("width");
  const height = dimension("height");

  return (
    <Panel>
      <Panel.Section title="Layout">
        <Panel.Subsection>
          <Panel.Row align="start">
            <Panel.Column gap="sm" width="full">
              <Panel.ResetAffordance
                label="layout direction"
                show={active && overrideReset.hasOverride(DIRECTION_KEYS)}
                onReset={() => reset(DIRECTION_KEYS)}
              >
                <Panel.ToggleGroup
                  mixed={mixedKeys.has("flexDirection")}
                  options={[
                    { value: "column", icon: "arrowDown" },
                    { value: "row", icon: "arrowRight" },
                  ]}
                  value={node.flexDirection}
                  width="full"
                  onChange={(value) => handleChange({ flexDirection: value as FlexDirection })}
                />
              </Panel.ResetAffordance>
              <Panel.ResetAffordance
                label="layout gap"
                show={active && overrideReset.hasOverride(GAP_KEYS)}
                onReset={() => reset(GAP_KEYS)}
              >
                <Panel.TextField
                  kind="number"
                  icon="betweenHorizontalStart"
                  step={1}
                  placeholder="Gap"
                  mixed={mixedKeys.has("gap")}
                  value={node.gap.toString()}
                  onChange={(value) => handleDraftChange({ gap: Number(value) })}
                  onCommit={handleCommit}
                />
              </Panel.ResetAffordance>
            </Panel.Column>
            <Panel.ResetAffordance
              label="layout alignment"
              show={active && overrideReset.hasOverride(ALIGNMENT_KEYS)}
              onReset={() => reset(ALIGNMENT_KEYS)}
            >
              <Panel.AlignmentGrid
                flexDirection={node.flexDirection}
                alignItems={node.alignItems}
                justifyContent={node.justifyContent}
                mixed={mixedKeys.has("alignItems") || mixedKeys.has("justifyContent")}
                onChange={(value) => {
                  const changes = value as {
                    alignItems: AlignItems;
                    justifyContent: JustifyContent;
                  };
                  // Container alignment goes through the virtual-stretch
                  // expand transform so leaving a stretch container keeps its
                  // filling children filling (per-child alignSelf: "stretch").
                  dispatch(updateContainerAlignment)({
                    nodes: targets,
                    alignItems: changes.alignItems,
                    justifyContent: changes.justifyContent,
                  });
                }}
              />
            </Panel.ResetAffordance>
          </Panel.Row>
        </Panel.Subsection>

        <Panel.Subsection title="Dimensions">
          <Panel.Row align="stretch">
            <Panel.ResetAffordance
              label="width"
              show={active && overrideReset.hasOverride(WIDTH_KEYS)}
              onReset={() => reset(WIDTH_KEYS)}
            >
              <Panel.DimensionField
                axis="width"
                mode={width.mode}
                value={width.value}
                computed={width.computed ?? undefined}
                label="Width"
                disabled={!editableDimensions}
                mixed={mixedKeys.has("width")}
                onChange={(value) => handleDraftChange({ width: Number(value) })}
                onCommit={handleCommit}
                onModeChange={(mode) => width.onModeChange(mode as DimensionState)}
              />
            </Panel.ResetAffordance>
            <Panel.ResetAffordance
              label="height"
              show={active && overrideReset.hasOverride(HEIGHT_KEYS)}
              onReset={() => reset(HEIGHT_KEYS)}
            >
              <Panel.DimensionField
                axis="height"
                mode={height.mode}
                value={height.value}
                computed={height.computed ?? undefined}
                label="Height"
                disabled={!editableDimensions}
                mixed={mixedKeys.has("height")}
                onChange={(value) => handleDraftChange({ height: Number(value) })}
                onCommit={handleCommit}
                onModeChange={(mode) => height.onModeChange(mode as DimensionState)}
              />
            </Panel.ResetAffordance>
          </Panel.Row>
        </Panel.Subsection>

        <Panel.Subsection title="Padding">
          <Panel.Row align="start">
            {showIndividualPadding && (
              <Panel.Column gap="sm" width="full">
                <Panel.Row align="stretch">
                  <Panel.ResetAffordance
                    label="padding left"
                    show={active && overrideReset.hasOverride(PADDING_LEFT_KEYS)}
                    onReset={() => reset(PADDING_LEFT_KEYS)}
                  >
                    <Panel.TextField
                      kind="number"
                      icon="panelLeftDashed"
                      step={1}
                      placeholder="Padding Left"
                      mixed={mixedKeys.has("paddingLeft")}
                      value={node.paddingLeft.toString()}
                      onChange={(value) => handleDraftChange({ paddingLeft: Number(value) })}
                      onCommit={handleCommit}
                    />
                  </Panel.ResetAffordance>
                  <Panel.ResetAffordance
                    label="padding top"
                    show={active && overrideReset.hasOverride(PADDING_TOP_KEYS)}
                    onReset={() => reset(PADDING_TOP_KEYS)}
                  >
                    <Panel.TextField
                      kind="number"
                      icon="panelTopDashed"
                      step={1}
                      placeholder="Padding Top"
                      mixed={mixedKeys.has("paddingTop")}
                      value={node.paddingTop.toString()}
                      onChange={(value) => handleDraftChange({ paddingTop: Number(value) })}
                      onCommit={handleCommit}
                    />
                  </Panel.ResetAffordance>
                </Panel.Row>
                <Panel.Row align="stretch">
                  <Panel.ResetAffordance
                    label="padding right"
                    show={active && overrideReset.hasOverride(PADDING_RIGHT_KEYS)}
                    onReset={() => reset(PADDING_RIGHT_KEYS)}
                  >
                    <Panel.TextField
                      kind="number"
                      icon="panelRightDashed"
                      step={1}
                      placeholder="Padding Right"
                      mixed={mixedKeys.has("paddingRight")}
                      value={node.paddingRight.toString()}
                      onChange={(value) => handleDraftChange({ paddingRight: Number(value) })}
                      onCommit={handleCommit}
                    />
                  </Panel.ResetAffordance>
                  <Panel.ResetAffordance
                    label="padding bottom"
                    show={active && overrideReset.hasOverride(PADDING_BOTTOM_KEYS)}
                    onReset={() => reset(PADDING_BOTTOM_KEYS)}
                  >
                    <Panel.TextField
                      kind="number"
                      icon="panelBottomDashed"
                      step={1}
                      placeholder="Padding Bottom"
                      mixed={mixedKeys.has("paddingBottom")}
                      value={node.paddingBottom.toString()}
                      onChange={(value) => handleDraftChange({ paddingBottom: Number(value) })}
                      onCommit={handleCommit}
                    />
                  </Panel.ResetAffordance>
                </Panel.Row>
              </Panel.Column>
            )}

            {!showIndividualPadding && (
              <Panel.Column gap="sm" width="full">
                <Panel.Row align="stretch">
                  <Panel.ResetAffordance
                    label="padding horizontal"
                    show={active && overrideReset.hasOverride(PADDING_HORIZONTAL_KEYS)}
                    onReset={() => reset(PADDING_HORIZONTAL_KEYS)}
                  >
                    <Panel.TextField
                      kind="number"
                      icon="panelLeftRightDashed"
                      step={1}
                      placeholder="Padding Horizontal"
                      mixed={mixedKeys.has("paddingLeft") || mixedKeys.has("paddingRight")}
                      value={node.paddingLeft.toString()}
                      onChange={(value) =>
                        handleDraftChange({
                          paddingLeft: Number(value),
                          paddingRight: Number(value),
                        })
                      }
                      onCommit={handleCommit}
                    />
                  </Panel.ResetAffordance>
                  <Panel.ResetAffordance
                    label="padding vertical"
                    show={active && overrideReset.hasOverride(PADDING_VERTICAL_KEYS)}
                    onReset={() => reset(PADDING_VERTICAL_KEYS)}
                  >
                    <Panel.TextField
                      kind="number"
                      icon="panelTopBottomDashed"
                      step={1}
                      placeholder="Padding Top"
                      mixed={mixedKeys.has("paddingTop") || mixedKeys.has("paddingBottom")}
                      value={node.paddingTop.toString()}
                      onChange={(value) =>
                        handleDraftChange({
                          paddingTop: Number(value),
                          paddingBottom: Number(value),
                        })
                      }
                      onCommit={handleCommit}
                    />
                  </Panel.ResetAffordance>
                </Panel.Row>
              </Panel.Column>
            )}

            <Panel.Button
              icon={showIndividualPadding ? "vault" : "fullscreen"}
              size="icon-sm"
              onClick={() =>
                showIndividualPadding ? collapsePadding() : setShowIndividualPadding(true)
              }
            />
          </Panel.Row>
        </Panel.Subsection>
      </Panel.Section>
    </Panel>
  );
}

"use client";

/**
 * Built-in panel definition for relative and absolute positioning.
 *
 * Structure (JSX → wire nodes):
 * - `PanelSection` "Position" → `Panel.Section title="Position"`.
 * - The absolute-position toggle sits in the header, right-aligned →
 *   `Panel.SectionActions` > `Panel.Button icon="scan"` (the host renderer hoists
 *   a section's `sectionActions` into its header). Pressed (`variant="default"`) =
 *   absolute, unpressed (`variant="ghost"`) = relative.
 * - X and Y offset fields are ALWAYS present → two `Panel.TextField`s in a
 *   `Panel.Row`.
 *
 * Behavior (identical to the legacy section):
 * - `position === "absolute"` (and not mixed): fields ENABLED, editing `left`/
 *   `top` (an `"auto"` value shows `0`) as a DRAFT gesture (begin-on-first-change
 *   → live write → commit).
 * - otherwise (relative, or a mixed `position` across the selection): fields
 *   DISABLED, showing the FIRST node's measured offset within its parent (read
 *   live from the canvas bounding boxes, rounded; `0` when boxes are missing) —
 *   Figma-style read-only coordinates.
 * - the toggle is a DIRECT write (one undo): ON seeds each node's `left`/`top`
 *   from its OWN offset (current numeric value, else its own parent offset, else
 *   `0`/`0`) via {@link buildAbsolutePositionSeeds} — a single undoable command so
 *   a multi-selection stays visually in place; OFF writes `{position: "relative",
 *   left/top/right/bottom: "auto"}`.
 */
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import { useCallback } from "react";
import { useStore } from "zustand";

import { useDesignerDraft } from "../../../hooks/use-designer-draft";
import { applyPerNodeLayoutStyle, updateLayoutStyle } from "../../../state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "../../../state/designer-store";
import { buildAbsolutePositionSeeds } from "../utils/seed-absolute-position";
import { useDefinitionNodes } from "./use-definition-nodes";

/** The position style the panel reads and writes (always present on view + text nodes). */
interface PositionStyle {
  position: "relative" | "absolute";
  left: number | "auto";
  top: number | "auto";
  right: number | "auto";
  bottom: number | "auto";
}

/** The numeric value an offset input shows: the stored number, or `0` for `"auto"`. */
function offsetValue(value: number | "auto"): number {
  return typeof value === "number" ? value : 0;
}

/** The `Position` panel definition. */
export function PositionPanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { nodes, style, targets, mixedKeys } = useDefinitionNodes();
  const { draft, begin, commit } = useDesignerDraft(store);

  const node = style as PositionStyle | null;
  const firstNodeId = nodes[0]?.id ?? null;
  const firstParentId = nodes[0]?.parentId ?? null;

  // The first node's + its parent's raw bounding boxes, read live from the
  // canvas. Selected as STABLE references (never a freshly-built object) so the
  // `useSyncExternalStore` snapshot stays cached — the offset is derived below.
  const nodeBox = useStore(store, (state) =>
    firstNodeId ? (state.canvas.boundingBoxes[firstNodeId] ?? null) : null,
  );
  const parentBox = useStore(store, (state) =>
    firstParentId ? (state.canvas.boundingBoxes[firstParentId] ?? null) : null,
  );
  // The first node's measured offset within its parent — the value the disabled
  // X/Y fields show in relative flow.
  const measuredOffset =
    nodeBox && parentBox ? { left: nodeBox.x - parentBox.x, top: nodeBox.y - parentBox.y } : null;

  const handleDraftChange = useCallback(
    (incoming: Partial<PositionStyle>) => {
      if (!draft) begin();
      dispatch(updateLayoutStyle)({ nodes: targets, style: incoming });
    },
    [draft, begin, dispatch, targets],
  );

  const handleCommit = useCallback(() => {
    commit();
  }, [commit]);

  const enableAbsolute = useCallback(() => {
    // Seed each node from ITS OWN offset (current numeric left/top, else its own
    // parent offset, else 0/0) so a multi-selection stays spread out rather than
    // stacking on the first node's spot — applied as a single undoable command.
    const seeds = buildAbsolutePositionSeeds(
      nodes,
      targets,
      store.getState().canvas.boundingBoxes,
    );
    if (seeds.length === 0) return;
    dispatch(applyPerNodeLayoutStyle)({ nodes: seeds });
  }, [nodes, targets, store, dispatch]);

  const disableAbsolute = useCallback(() => {
    dispatch(updateLayoutStyle)({
      nodes: targets,
      style: {
        position: "relative",
        left: "auto",
        top: "auto",
        right: "auto",
        bottom: "auto",
      },
    });
  }, [dispatch, targets]);

  if (!node) return <Panel />;

  const isAbsolute = node.position === "absolute";
  const mixedPosition = mixedKeys.has("position");
  const inputsEnabled = isAbsolute && !mixedPosition;

  // Absolute + uniform: the stored offsets (auto → 0). Otherwise (relative or
  // mixed) the fields are read-only, showing the measured parent offset.
  const xValue = inputsEnabled ? offsetValue(node.left) : Math.round(measuredOffset?.left ?? 0);
  const yValue = inputsEnabled ? offsetValue(node.top) : Math.round(measuredOffset?.top ?? 0);

  return (
    <Panel>
      <Panel.Section title="Position">
        <Panel.SectionActions>
          <Panel.Button
            label="Absolute position"
            icon="scan"
            size="icon-sm"
            variant={isAbsolute ? "default" : "ghost"}
            onClick={isAbsolute ? disableAbsolute : enableAbsolute}
          />
        </Panel.SectionActions>
        <Panel.Row align="stretch">
          <Panel.TextField
            kind="number"
            icon="arrowRight"
            step={1}
            placeholder="X"
            disabled={!inputsEnabled}
            mixed={inputsEnabled && mixedKeys.has("left")}
            value={xValue.toString()}
            onChange={(value) => handleDraftChange({ left: Number(value) })}
            onCommit={handleCommit}
          />
          <Panel.TextField
            kind="number"
            icon="arrowDown"
            step={1}
            placeholder="Y"
            disabled={!inputsEnabled}
            mixed={inputsEnabled && mixedKeys.has("top")}
            value={yValue.toString()}
            onChange={(value) => handleDraftChange({ top: Number(value) })}
            onCommit={handleCommit}
          />
        </Panel.Row>
      </Panel.Section>
    </Panel>
  );
}

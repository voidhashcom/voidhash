"use client";

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useDesignerDraft } from "@/features/studio/paywalls/designer/hooks/use-designer-draft";
import { Schema } from "effect";
import { ArrowDownIcon, ArrowRightIcon, ScanIcon } from "lucide-react";
import { useCallback } from "react";
import { useStore } from "zustand";

import { Button } from "@voidhash/ui";
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionHeaderActions,
  PanelSectionTitle,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";
import {
  applyPerNodeLayoutStyle,
  updateLayoutStyle,
} from "@/features/studio/paywalls/designer/state/actions";
import { usePaywallDesignerActions } from "@/features/studio/paywalls/designer/state/designer-store";

import { usePaywallDesignerStore } from "../../../state/designer-store";
import { buildAbsolutePositionSeeds } from "../utils/seed-absolute-position";
import { TextInput } from "../inputs/text-input";
import { useStyleTargets } from "../utils/get-style-targets";

/** The position style the section reads and writes (always present on view + text nodes). */
type PositionNode = {
  position: "relative" | "absolute";
  left: number | "auto";
  top: number | "auto";
  right: number | "auto";
  bottom: number | "auto";
};

/** The numeric value an offset input shows: the stored number, or `0` for `"auto"`. */
function offsetValue(value: number | "auto"): number {
  return typeof value === "number" ? value : 0;
}

export interface PositionSectionProps {
  nodes: SnapshotNode[];
}

/**
 * The dedicated `Position` section (view + text nodes, single or multi-select).
 *
 * The absolute-position toggle lives as an icon button on the RIGHT of the
 * section header (pressed = absolute). X/Y offset inputs are ALWAYS visible:
 * - absolute: enabled, editing `left`/`top` (an `"auto"` value shows `0`), a live
 *   draft preview that commits on release, exactly like the old subsection.
 * - relative: disabled, showing the first node's measured offset within its
 *   parent (read live from the canvas bounding boxes, `0` when boxes are missing)
 *   — Figma-style read-only coordinates.
 *
 * Toggling ON seeds each node's `left`/`top` from its OWN offset (via
 * {@link buildAbsolutePositionSeeds}) so a multi-selection stays visually in
 * place; toggling OFF clears all four inset fields back to `"auto"`. A mixed
 * `position` across the selection disables the inputs and suppresses editing.
 */
export function PositionSection({ nodes }: PositionSectionProps) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { style, targets, mixedKeys } = useStyleTargets(nodes);
  const { draft, begin, commit } = useDesignerDraft(store);

  const node = style as PositionNode | null;
  const firstNode = nodes[0] as SnapshotNode | undefined;
  const firstNodeId = firstNode?.id ?? null;
  const firstParentId = firstNode?.parentId ?? null;

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
    (incoming: Partial<PositionNode>) => {
      if (!draft) begin();
      dispatch(updateLayoutStyle)({ nodes: targets, style: incoming });
    },
    [draft, begin, dispatch, targets],
  );

  const handleCommit = useCallback(() => {
    commit();
  }, [commit]);

  // Toggling absolute positioning ON seeds each node from ITS OWN offset (so a
  // multi-selection stays spread out, not stacked on the first node's spot) in a
  // single undoable command.
  const enableAbsolute = useCallback(() => {
    const seeds = buildAbsolutePositionSeeds(
      nodes,
      targets,
      store.getState().canvas.boundingBoxes,
    );
    if (seeds.length === 0) return;
    dispatch(applyPerNodeLayoutStyle)({ nodes: seeds });
  }, [dispatch, nodes, targets, store]);

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

  if (!node) return null;

  const isAbsolute = node.position === "absolute";
  const mixedPosition = mixedKeys.has("position");
  const inputsEnabled = isAbsolute && !mixedPosition;

  // Absolute + uniform: the stored offsets (auto → 0). Otherwise (relative or
  // mixed) the fields are read-only, showing the measured parent offset.
  const xValue = inputsEnabled ? offsetValue(node.left) : Math.round(measuredOffset?.left ?? 0);
  const yValue = inputsEnabled ? offsetValue(node.top) : Math.round(measuredOffset?.top ?? 0);

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Position</PanelSectionTitle>
        <PanelSectionHeaderActions>
          <Button
            aria-label="Absolute position"
            aria-pressed={isAbsolute}
            onClick={() => (isAbsolute ? disableAbsolute() : enableAbsolute())}
            size="icon-sm"
            variant={isAbsolute ? "default" : "ghost"}
          >
            <ScanIcon className="size-3.5" />
          </Button>
        </PanelSectionHeaderActions>
      </PanelSectionHeader>
      <PanelSectionContent>
        <div className="flex flex-row gap-2">
          <TextInput
            disabled={!inputsEnabled}
            icon={<ArrowRightIcon className="size-3.5" />}
            label="X"
            mixed={inputsEnabled && mixedKeys.has("left")}
            onChange={(value) => handleDraftChange({ left: Number(value) })}
            onCommit={handleCommit}
            type="number"
            typeNumberStepIncrement={1}
            validator={Schema.String}
            value={xValue.toString()}
          />
          <TextInput
            disabled={!inputsEnabled}
            icon={<ArrowDownIcon className="size-3.5" />}
            label="Y"
            mixed={inputsEnabled && mixedKeys.has("top")}
            onChange={(value) => handleDraftChange({ top: Number(value) })}
            onCommit={handleCommit}
            type="number"
            typeNumberStepIncrement={1}
            validator={Schema.String}
            value={yValue.toString()}
          />
        </div>
      </PanelSectionContent>
    </PanelSection>
  );
}

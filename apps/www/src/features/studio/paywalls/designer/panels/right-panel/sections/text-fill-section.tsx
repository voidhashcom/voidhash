"use client";

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useDesignerDraft } from "@/features/studio/paywalls/designer/hooks/use-designer-draft";
import { useCallback } from "react";

import { ColorInput } from "@/features/studio/paywalls/designer/components/ui/color-input";
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";
import { updateTextFillStyle } from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";

import { OverrideResetAffordance } from "../components/override-reset-affordance";
import { useStyleTargets } from "../utils/get-style-targets";
import { useStyleOverrideResetContext } from "../utils/use-style-override-reset-context";

export function TextFillSection({ nodes }: { nodes: SnapshotNode[] }) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { style, targets, mixedKeys } = useStyleTargets(nodes);
  const overrideReset = useStyleOverrideResetContext(nodes);
  const { begin, commit, discard } = useDesignerDraft(store);
  const colorKeys = ["color"] as const;

  const fill = style as { color: string } | null;
  const showColorReset = overrideReset.isOverrideModeActive && overrideReset.hasOverride(colorKeys);

  const handleColorChange = useCallback(
    (value: string) => {
      dispatch(updateTextFillStyle)({
        nodes: targets,
        style: { color: value },
      });
    },
    [dispatch, targets],
  );
  const handleChange = useCallback(
    (incoming: Partial<{ color: string }>) => {
      dispatch(updateTextFillStyle)({
        nodes: targets,
        style: incoming,
      });
    },
    [dispatch, targets],
  );

  if (!fill) return null;

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Fill</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        <OverrideResetAffordance
          label="text color"
          onReset={() =>
            handleChange(
              overrideReset.buildResetPatch(colorKeys) as Partial<{
                color: string;
              }>,
            )
          }
          show={showColorReset}
        >
          <ColorInput
            mixed={mixedKeys.has("color")}
            onChange={handleColorChange}
            onCommit={commit}
            onDiscard={discard}
            onDragStart={begin}
            value={fill.color}
          />
        </OverrideResetAffordance>
      </PanelSectionContent>
    </PanelSection>
  );
}

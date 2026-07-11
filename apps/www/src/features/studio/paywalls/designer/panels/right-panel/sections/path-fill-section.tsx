"use client";

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useDesignerDraft } from "@/features/studio/paywalls/designer/hooks/use-designer-draft";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useCallback } from "react";

import { Button, ToggleGroup, ToggleGroupItem } from "@voidhash/ui";
import { ColorInput } from "@/features/studio/paywalls/designer/components/ui/color-input";
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionHeaderActions,
  PanelSectionTitle,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";
import { updatePathFillStyle } from "@/features/studio/paywalls/designer/state/actions/features/path-fill-style-actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";

import { useStyleTargets } from "../utils/get-style-targets";

interface PathFillStyle {
  fillColor: string;
  fillEnabled: boolean;
  fillRule: "nonzero" | "evenodd";
  fillOpacity: number;
}

export function PathFillSection({ nodes }: { nodes: SnapshotNode[] }) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { style, targets } = useStyleTargets(nodes);
  const { begin, commit, discard } = useDesignerDraft(store);

  const fill = style as unknown as PathFillStyle | null;

  const handleChange = useCallback(
    (incoming: Partial<PathFillStyle>) => {
      dispatch(updatePathFillStyle)({ nodes: targets, style: incoming });
    },
    [dispatch, targets],
  );

  const handleColorChange = useCallback(
    (value: string) => {
      dispatch(updatePathFillStyle)({
        nodes: targets,
        style: { fillColor: value },
      });
    },
    [dispatch, targets],
  );

  if (!fill) return null;

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Fill</PanelSectionTitle>
        <PanelSectionHeaderActions>
          {!fill.fillEnabled && (
            <Button
              onClick={() => handleChange({ fillEnabled: true })}
              size="icon-sm"
              variant="secondary"
            >
              <PlusIcon />
            </Button>
          )}
        </PanelSectionHeaderActions>
      </PanelSectionHeader>
      {fill.fillEnabled && (
        <PanelSectionContent>
          <div className="flex flex-row justify-between gap-2">
            <ToggleGroup
              variant="outline"
              size="sm"
              onValueChange={(value) => {
                if (value === "nonzero" || value === "evenodd") {
                  handleChange({ fillRule: value });
                }
              }}
              type="single"
              value={fill.fillRule}
            >
              <ToggleGroupItem size="sm" className="flex-1" value="nonzero">
                Nonzero
              </ToggleGroupItem>
              <ToggleGroupItem size="sm" className="flex-1" value="evenodd">
                Even-odd
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              onClick={() => handleChange({ fillEnabled: false })}
              size="icon-sm"
              variant="secondary"
            >
              <MinusIcon />
            </Button>
          </div>
          <ColorInput
            onChange={handleColorChange}
            onCommit={commit}
            onDiscard={discard}
            onDragStart={begin}
            value={fill.fillColor}
          />
        </PanelSectionContent>
      )}
    </PanelSection>
  );
}

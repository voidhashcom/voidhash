"use client";

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useDesignerDraft } from "@/features/studio/paywalls/designer/hooks/use-designer-draft";
import { Schema } from "effect";
import { MinusIcon, PlusIcon, SquareIcon } from "lucide-react";
import { useCallback } from "react";

import { Button, ToggleGroup, ToggleGroupItem } from "@voidhash/ui";
import { ColorInput } from "@/features/studio/paywalls/designer/components/ui/color-input";
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionHeaderActions,
  PanelSectionTitle,
  PanelSubSection,
  PanelSubSectionContent,
  PanelSubSectionTitle,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";
import { updatePathStrokeStyle } from "@/features/studio/paywalls/designer/state/actions/features/path-stroke-style-actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";

import { TextInput } from "../inputs/text-input";
import { useStyleTargets } from "../utils/get-style-targets";

interface PathStrokeStyle {
  strokeColor: string;
  strokeEnabled: boolean;
  strokeWidth: number;
  strokeLinecap: "butt" | "round" | "square";
  strokeLinejoin: "miter" | "round" | "bevel";
  strokeOpacity: number;
}

export function PathStrokeSection({ nodes }: { nodes: SnapshotNode[] }) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { style, targets } = useStyleTargets(nodes);
  const { draft, begin, commit, discard } = useDesignerDraft(store);

  const stroke = style as unknown as PathStrokeStyle | null;

  const handleChange = useCallback(
    (incoming: Partial<PathStrokeStyle>) => {
      dispatch(updatePathStrokeStyle)({ nodes: targets, style: incoming });
    },
    [dispatch, targets],
  );

  const handleDraftChange = useCallback(
    (incoming: Partial<PathStrokeStyle>) => {
      if (!draft) begin();
      dispatch(updatePathStrokeStyle)({ nodes: targets, style: incoming });
    },
    [draft, begin, dispatch, targets],
  );

  const handleCommit = useCallback(() => {
    commit();
  }, [commit]);

  if (!stroke) return null;

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Stroke</PanelSectionTitle>
        <PanelSectionHeaderActions>
          {!stroke.strokeEnabled && (
            <Button
              onClick={() => handleChange({ strokeEnabled: true })}
              size="icon-sm"
              variant="secondary"
            >
              <PlusIcon />
            </Button>
          )}
        </PanelSectionHeaderActions>
      </PanelSectionHeader>
      {stroke.strokeEnabled && (
        <PanelSectionContent>
          <PanelSubSection>
            <PanelSubSectionTitle>Width</PanelSubSectionTitle>
            <PanelSubSectionContent>
              <div className="flex flex-row gap-2">
                <TextInput
                  icon={<SquareIcon className="size-3.5" />}
                  label="Stroke Width"
                  minValue={0}
                  onChange={(value) => {
                    handleDraftChange({ strokeWidth: Number(value) });
                  }}
                  onCommit={handleCommit}
                  type="number"
                  typeNumberStepIncrement={1}
                  validator={Schema.String}
                  value={stroke.strokeWidth.toString()}
                />
                <Button
                  onClick={() => handleChange({ strokeEnabled: false })}
                  size="icon-sm"
                  variant="secondary"
                >
                  <MinusIcon />
                </Button>
              </div>
            </PanelSubSectionContent>
          </PanelSubSection>
          <PanelSubSection>
            <PanelSubSectionTitle>Line Cap</PanelSubSectionTitle>
            <PanelSubSectionContent>
              <ToggleGroup
                variant="outline"
                size="sm"
                onValueChange={(value) => {
                  if (value === "butt" || value === "round" || value === "square") {
                    handleChange({ strokeLinecap: value });
                  }
                }}
                type="single"
                value={stroke.strokeLinecap}
              >
                <ToggleGroupItem size="sm" className="flex-1" value="butt">
                  Butt
                </ToggleGroupItem>
                <ToggleGroupItem size="sm" className="flex-1" value="round">
                  Round
                </ToggleGroupItem>
                <ToggleGroupItem size="sm" className="flex-1" value="square">
                  Square
                </ToggleGroupItem>
              </ToggleGroup>
            </PanelSubSectionContent>
          </PanelSubSection>
          <PanelSubSection>
            <PanelSubSectionTitle>Line Join</PanelSubSectionTitle>
            <PanelSubSectionContent>
              <ToggleGroup
                variant="outline"
                size="sm"
                onValueChange={(value) => {
                  if (value === "miter" || value === "round" || value === "bevel") {
                    handleChange({ strokeLinejoin: value });
                  }
                }}
                type="single"
                value={stroke.strokeLinejoin}
              >
                <ToggleGroupItem size="sm" className="flex-1" value="miter">
                  Miter
                </ToggleGroupItem>
                <ToggleGroupItem size="sm" className="flex-1" value="round">
                  Round
                </ToggleGroupItem>
                <ToggleGroupItem size="sm" className="flex-1" value="bevel">
                  Bevel
                </ToggleGroupItem>
              </ToggleGroup>
            </PanelSubSectionContent>
          </PanelSubSection>
          <ColorInput
            onChange={(value) => handleChange({ strokeColor: value })}
            onCommit={commit}
            onDiscard={discard}
            onDragStart={begin}
            value={stroke.strokeColor}
          />
        </PanelSectionContent>
      )}
    </PanelSection>
  );
}

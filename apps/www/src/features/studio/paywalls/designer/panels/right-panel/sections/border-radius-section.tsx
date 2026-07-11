"use client";

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useDesignerDraft } from "@/features/studio/paywalls/designer/hooks/use-designer-draft";
import { Schema } from "effect";
import { FullscreenIcon, ScanIcon, SquareRoundCorner, VaultIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@voidhash/ui";
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
  PanelSubSection,
  PanelSubSectionContent,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";
import { updateBorderRadiusStyle } from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";

import { OverrideResetAffordance } from "../components/override-reset-affordance";
import { TextInput } from "../inputs/text-input";
import { useStyleTargets } from "../utils/get-style-targets";
import { useStyleOverrideResetContext } from "../utils/use-style-override-reset-context";

type BorderRadiusNode = {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
};

function shouldShowIndividualBorderRadius(node: BorderRadiusNode) {
  return (
    node.borderTopLeftRadius !== node.borderTopRightRadius ||
    node.borderTopLeftRadius !== node.borderBottomRightRadius ||
    node.borderTopLeftRadius !== node.borderBottomLeftRadius ||
    node.borderTopRightRadius !== node.borderBottomRightRadius ||
    node.borderTopRightRadius !== node.borderBottomLeftRadius ||
    node.borderBottomRightRadius !== node.borderBottomLeftRadius
  );
}

export function BorderRadiusSection({ nodes }: { nodes: SnapshotNode[] }) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { style, targets, mixedKeys } = useStyleTargets(nodes);
  const overrideReset = useStyleOverrideResetContext(nodes);
  const { draft, begin, commit } = useDesignerDraft(store);
  const borderRadiusAllKeys = [
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomRightRadius",
    "borderBottomLeftRadius",
  ] as const;
  const borderTopLeftRadiusKeys = ["borderTopLeftRadius"] as const;
  const borderTopRightRadiusKeys = ["borderTopRightRadius"] as const;
  const borderBottomLeftRadiusKeys = ["borderBottomLeftRadius"] as const;
  const borderBottomRightRadiusKeys = ["borderBottomRightRadius"] as const;

  const [showIndividualBorderRadius, setShowIndividualBorderRadius] = useState(() => {
    if (!style) return false;
    if (
      mixedKeys.has("borderTopLeftRadius") ||
      mixedKeys.has("borderTopRightRadius") ||
      mixedKeys.has("borderBottomRightRadius") ||
      mixedKeys.has("borderBottomLeftRadius")
    ) {
      return true;
    }
    return shouldShowIndividualBorderRadius(style as BorderRadiusNode);
  });

  const node = style as BorderRadiusNode | null;
  const showBorderRadiusAllReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(borderRadiusAllKeys);
  const showBorderRadiusTopLeftReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(borderTopLeftRadiusKeys);
  const showBorderRadiusTopRightReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(borderTopRightRadiusKeys);
  const showBorderRadiusBottomLeftReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(borderBottomLeftRadiusKeys);
  const showBorderRadiusBottomRightReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(borderBottomRightRadiusKeys);

  const handleChange = useCallback(
    (incoming: Partial<BorderRadiusNode>) => {
      dispatch(updateBorderRadiusStyle)({ nodes: targets, style: incoming });
    },
    [dispatch, targets],
  );

  const handleDraftChange = useCallback(
    (incoming: Partial<BorderRadiusNode>) => {
      if (!draft) begin();
      dispatch(updateBorderRadiusStyle)({ nodes: targets, style: incoming });
    },
    [draft, begin, dispatch, targets],
  );

  const handleCommit = useCallback(() => {
    commit();
  }, [commit]);

  const expandBorderRadius = () => {
    setShowIndividualBorderRadius(true);
  };

  const collapseBorderRadius = () => {
    if (!node) return;
    setShowIndividualBorderRadius(false);
    const allCornersValue = node.borderTopLeftRadius;
    handleChange({
      borderTopLeftRadius: allCornersValue,
      borderTopRightRadius: allCornersValue,
      borderBottomRightRadius: allCornersValue,
      borderBottomLeftRadius: allCornersValue,
    });
  };

  if (!node) return null;

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Border Radius</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        <PanelSubSection>
          <PanelSubSectionContent>
            <div className="flex flex-row gap-2">
              {!showIndividualBorderRadius && (
                <OverrideResetAffordance
                  className="flex-1"
                  label="border radius"
                  onReset={() =>
                    handleChange(
                      overrideReset.buildResetPatch(
                        borderRadiusAllKeys,
                      ) as Partial<BorderRadiusNode>,
                    )
                  }
                  show={showBorderRadiusAllReset}
                >
                  <TextInput
                    icon={<ScanIcon className="size-3.5" />}
                    label="Radius"
                    mixed={
                      mixedKeys.has("borderTopLeftRadius") ||
                      mixedKeys.has("borderTopRightRadius") ||
                      mixedKeys.has("borderBottomRightRadius") ||
                      mixedKeys.has("borderBottomLeftRadius")
                    }
                    minValue={0}
                    maxValue={100}
                    onChange={(value) => {
                      const numValue = Number(value);
                      handleDraftChange({
                        borderTopLeftRadius: numValue,
                        borderTopRightRadius: numValue,
                        borderBottomRightRadius: numValue,
                        borderBottomLeftRadius: numValue,
                      });
                    }}
                    onCommit={handleCommit}
                    type="number"
                    typeNumberStepIncrement={1}
                    validator={Schema.String}
                    value={node.borderTopLeftRadius.toString()}
                  />
                </OverrideResetAffordance>
              )}

              {showIndividualBorderRadius && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-row gap-2">
                    <OverrideResetAffordance
                      className="flex-1"
                      label="top left border radius"
                      onReset={() =>
                        handleChange(
                          overrideReset.buildResetPatch(
                            borderTopLeftRadiusKeys,
                          ) as Partial<BorderRadiusNode>,
                        )
                      }
                      show={showBorderRadiusTopLeftReset}
                    >
                      <TextInput
                        icon={<SquareRoundCorner className="-scale-x-100 size-3.5" />}
                        label="Top Left"
                        mixed={mixedKeys.has("borderTopLeftRadius")}
                        minValue={0}
                        maxValue={100}
                        onChange={(value) =>
                          handleDraftChange({
                            borderTopLeftRadius: Number(value),
                          })
                        }
                        onCommit={handleCommit}
                        type="number"
                        typeNumberStepIncrement={1}
                        validator={Schema.String}
                        value={node.borderTopLeftRadius.toString()}
                      />
                    </OverrideResetAffordance>
                    <OverrideResetAffordance
                      className="flex-1"
                      label="top right border radius"
                      onReset={() =>
                        handleChange(
                          overrideReset.buildResetPatch(
                            borderTopRightRadiusKeys,
                          ) as Partial<BorderRadiusNode>,
                        )
                      }
                      show={showBorderRadiusTopRightReset}
                    >
                      <TextInput
                        icon={<SquareRoundCorner className="size-3.5" />}
                        label="Top Right"
                        mixed={mixedKeys.has("borderTopRightRadius")}
                        minValue={0}
                        maxValue={100}
                        onChange={(value) =>
                          handleDraftChange({
                            borderTopRightRadius: Number(value),
                          })
                        }
                        onCommit={handleCommit}
                        type="number"
                        typeNumberStepIncrement={1}
                        validator={Schema.String}
                        value={node.borderTopRightRadius.toString()}
                      />
                    </OverrideResetAffordance>
                  </div>
                  <div className="flex flex-row gap-2">
                    <OverrideResetAffordance
                      className="flex-1"
                      label="bottom left border radius"
                      onReset={() =>
                        handleChange(
                          overrideReset.buildResetPatch(
                            borderBottomLeftRadiusKeys,
                          ) as Partial<BorderRadiusNode>,
                        )
                      }
                      show={showBorderRadiusBottomLeftReset}
                    >
                      <TextInput
                        icon={<SquareRoundCorner className="rotate-180 size-3.5" />}
                        label="Bottom Left"
                        mixed={mixedKeys.has("borderBottomLeftRadius")}
                        minValue={0}
                        maxValue={100}
                        onChange={(value) =>
                          handleDraftChange({
                            borderBottomLeftRadius: Number(value),
                          })
                        }
                        onCommit={handleCommit}
                        type="number"
                        typeNumberStepIncrement={1}
                        validator={Schema.String}
                        value={node.borderBottomLeftRadius.toString()}
                      />
                    </OverrideResetAffordance>
                    <OverrideResetAffordance
                      className="flex-1"
                      label="bottom right border radius"
                      onReset={() =>
                        handleChange(
                          overrideReset.buildResetPatch(
                            borderBottomRightRadiusKeys,
                          ) as Partial<BorderRadiusNode>,
                        )
                      }
                      show={showBorderRadiusBottomRightReset}
                    >
                      <TextInput
                        icon={<SquareRoundCorner className="rotate-180 -scale-x-100  size-3.5" />}
                        label="Bottom Right"
                        mixed={mixedKeys.has("borderBottomRightRadius")}
                        minValue={0}
                        maxValue={100}
                        onChange={(value) =>
                          handleDraftChange({
                            borderBottomRightRadius: Number(value),
                          })
                        }
                        onCommit={handleCommit}
                        type="number"
                        typeNumberStepIncrement={1}
                        validator={Schema.String}
                        value={node.borderBottomRightRadius.toString()}
                      />
                    </OverrideResetAffordance>
                  </div>
                </div>
              )}

              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() =>
                  showIndividualBorderRadius ? collapseBorderRadius() : expandBorderRadius()
                }
              >
                {showIndividualBorderRadius ? (
                  <VaultIcon className="size-3.5" />
                ) : (
                  <FullscreenIcon className="size-3.5" />
                )}
              </Button>
            </div>
          </PanelSubSectionContent>
        </PanelSubSection>
      </PanelSectionContent>
    </PanelSection>
  );
}

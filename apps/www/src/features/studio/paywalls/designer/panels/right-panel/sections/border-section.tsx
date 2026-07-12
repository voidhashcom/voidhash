"use client";

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useDesignerDraft } from "@/features/studio/paywalls/designer/hooks/use-designer-draft";
import { Schema } from "effect";
import {
  FullscreenIcon,
  MinusIcon,
  PlusIcon,
  SquareDashedTopSolidIcon,
  SquareIcon,
  VaultIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@voidhash/ui";
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
import { updateBorderStyle } from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";

import { OverrideResetAffordance } from "../components/override-reset-affordance";
import { TextInput } from "../inputs/text-input";
import { useStyleTargets } from "../utils/get-style-targets";
import { useStyleOverrideResetContext } from "../utils/use-style-override-reset-context";

type BorderNode = {
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  borderColor: string;
  borderStyle: string;
  borderEnabled: boolean;
};

function shouldShowIndividualBorder(node: BorderNode) {
  return (
    node.borderTopWidth !== node.borderBottomWidth ||
    node.borderTopWidth !== node.borderLeftWidth ||
    node.borderTopWidth !== node.borderRightWidth ||
    node.borderBottomWidth !== node.borderLeftWidth ||
    node.borderBottomWidth !== node.borderRightWidth ||
    node.borderLeftWidth !== node.borderRightWidth
  );
}

export function BorderSection({ nodes }: { nodes: SnapshotNode[] }) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { style, targets, mixedKeys } = useStyleTargets(nodes);
  const overrideReset = useStyleOverrideResetContext(nodes);
  const { draft, begin, commit, discard } = useDesignerDraft(store);
  const isBorderEnabledMixed = mixedKeys.has("borderEnabled");
  const borderEnabledKeys = ["borderEnabled"] as const;
  const borderWidthAllKeys = [
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
  ] as const;
  const borderLeftWidthKeys = ["borderLeftWidth"] as const;
  const borderTopWidthKeys = ["borderTopWidth"] as const;
  const borderRightWidthKeys = ["borderRightWidth"] as const;
  const borderBottomWidthKeys = ["borderBottomWidth"] as const;
  const borderColorKeys = ["borderColor"] as const;
  const borderRelatedKeys = [
    "borderEnabled",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderColor",
  ] as const;

  const [showIndividualBorder, setShowIndividualBorder] = useState(() => {
    if (!style) return false;
    return shouldShowIndividualBorder(style as BorderNode);
  });

  const node = style as BorderNode | null;
  const showBorderEnabledReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(borderEnabledKeys);
  const showBorderWidthAllReset =
    !showBorderEnabledReset &&
    overrideReset.isOverrideModeActive &&
    overrideReset.hasOverride(borderWidthAllKeys);
  const showBorderWidthLeftReset =
    !showBorderEnabledReset &&
    overrideReset.isOverrideModeActive &&
    overrideReset.hasOverride(borderLeftWidthKeys);
  const showBorderWidthTopReset =
    !showBorderEnabledReset &&
    overrideReset.isOverrideModeActive &&
    overrideReset.hasOverride(borderTopWidthKeys);
  const showBorderWidthRightReset =
    !showBorderEnabledReset &&
    overrideReset.isOverrideModeActive &&
    overrideReset.hasOverride(borderRightWidthKeys);
  const showBorderWidthBottomReset =
    !showBorderEnabledReset &&
    overrideReset.isOverrideModeActive &&
    overrideReset.hasOverride(borderBottomWidthKeys);
  const showBorderColorReset =
    !showBorderEnabledReset &&
    overrideReset.isOverrideModeActive &&
    overrideReset.hasOverride(borderColorKeys);

  const handleChange = useCallback(
    (incoming: Partial<BorderNode>) => {
      dispatch(updateBorderStyle)({ nodes: targets, style: incoming });
    },
    [dispatch, targets],
  );

  const handleDraftChange = useCallback(
    (incoming: Partial<BorderNode>) => {
      if (!draft) begin();
      dispatch(updateBorderStyle)({ nodes: targets, style: incoming });
    },
    [draft, begin, dispatch, targets],
  );

  const handleCommit = useCallback(() => {
    commit();
  }, [commit]);

  const expandBorder = () => {
    setShowIndividualBorder(true);
  };

  const collapseBorder = () => {
    if (!node) return;
    setShowIndividualBorder(false);
    const allSidesValue = node.borderTopWidth;
    handleChange({
      borderLeftWidth: allSidesValue,
      borderRightWidth: allSidesValue,
      borderTopWidth: allSidesValue,
      borderBottomWidth: allSidesValue,
    });
  };

  if (!node) return null;

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Border</PanelSectionTitle>
        <PanelSectionHeaderActions>
          {!node.borderEnabled && !isBorderEnabledMixed && (
            <OverrideResetAffordance
              label="border enabled"
              onReset={() =>
                handleChange(
                  overrideReset.buildResetPatch(borderRelatedKeys) as Partial<BorderNode>,
                )
              }
              show={showBorderEnabledReset}
            >
              <Button
                onClick={() => handleChange({ borderEnabled: true })}
                size="icon-sm"
                variant="secondary"
              >
                <PlusIcon />
              </Button>
            </OverrideResetAffordance>
          )}
        </PanelSectionHeaderActions>
      </PanelSectionHeader>
      {(node.borderEnabled || isBorderEnabledMixed) && (
        <PanelSectionContent>
          <PanelSubSection>
            <PanelSubSectionTitle>Width</PanelSubSectionTitle>
            <PanelSubSectionContent>
              <OverrideResetAffordance
                label="border enabled"
                onReset={() =>
                  handleChange(
                    overrideReset.buildResetPatch(borderRelatedKeys) as Partial<BorderNode>,
                  )
                }
                show={showBorderEnabledReset}
              >
                <div className="flex flex-row gap-2">
                  {!showIndividualBorder && (
                    <OverrideResetAffordance
                      className="flex-1"
                      label="border width"
                      onReset={() =>
                        handleChange(
                          overrideReset.buildResetPatch(borderWidthAllKeys) as Partial<BorderNode>,
                        )
                      }
                      show={showBorderWidthAllReset}
                    >
                      <TextInput
                        icon={<SquareIcon className="size-3.5" />}
                        label="Width"
                        mixed={
                          mixedKeys.has("borderTopWidth") ||
                          mixedKeys.has("borderRightWidth") ||
                          mixedKeys.has("borderBottomWidth") ||
                          mixedKeys.has("borderLeftWidth")
                        }
                        minValue={0}
                        onChange={(value) => {
                          const numValue = Number(value);
                          handleDraftChange({
                            borderTopWidth: numValue,
                            borderRightWidth: numValue,
                            borderBottomWidth: numValue,
                            borderLeftWidth: numValue,
                          });
                        }}
                        onCommit={handleCommit}
                        type="number"
                        typeNumberStepIncrement={1}
                        validator={Schema.String}
                        value={node.borderTopWidth.toString()}
                      />
                    </OverrideResetAffordance>
                  )}

                  {showIndividualBorder && (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-row gap-2">
                        <OverrideResetAffordance
                          className="flex-1"
                          label="border left width"
                          onReset={() =>
                            handleChange(
                              overrideReset.buildResetPatch(
                                borderLeftWidthKeys,
                              ) as Partial<BorderNode>,
                            )
                          }
                          show={showBorderWidthLeftReset}
                        >
                          <TextInput
                            icon={<SquareDashedTopSolidIcon className="-rotate-90 size-3.5" />}
                            label="Border Left"
                            mixed={mixedKeys.has("borderLeftWidth")}
                            minValue={0}
                            onChange={(value) =>
                              handleDraftChange({
                                borderLeftWidth: Number(value),
                              })
                            }
                            onCommit={handleCommit}
                            type="number"
                            typeNumberStepIncrement={1}
                            validator={Schema.String}
                            value={node.borderLeftWidth.toString()}
                          />
                        </OverrideResetAffordance>
                        <OverrideResetAffordance
                          className="flex-1"
                          label="border top width"
                          onReset={() =>
                            handleChange(
                              overrideReset.buildResetPatch(
                                borderTopWidthKeys,
                              ) as Partial<BorderNode>,
                            )
                          }
                          show={showBorderWidthTopReset}
                        >
                          <TextInput
                            icon={<SquareDashedTopSolidIcon className="size-3.5" />}
                            label="Border Top"
                            mixed={mixedKeys.has("borderTopWidth")}
                            minValue={0}
                            onChange={(value) =>
                              handleDraftChange({
                                borderTopWidth: Number(value),
                              })
                            }
                            onCommit={handleCommit}
                            type="number"
                            typeNumberStepIncrement={1}
                            validator={Schema.String}
                            value={node.borderTopWidth.toString()}
                          />
                        </OverrideResetAffordance>
                      </div>
                      <div className="flex flex-row gap-2">
                        <OverrideResetAffordance
                          className="flex-1"
                          label="border right width"
                          onReset={() =>
                            handleChange(
                              overrideReset.buildResetPatch(
                                borderRightWidthKeys,
                              ) as Partial<BorderNode>,
                            )
                          }
                          show={showBorderWidthRightReset}
                        >
                          <TextInput
                            icon={<SquareDashedTopSolidIcon className="rotate-90 size-3.5" />}
                            label="Border Right"
                            mixed={mixedKeys.has("borderRightWidth")}
                            minValue={0}
                            onChange={(value) =>
                              handleDraftChange({
                                borderRightWidth: Number(value),
                              })
                            }
                            onCommit={handleCommit}
                            type="number"
                            typeNumberStepIncrement={1}
                            validator={Schema.String}
                            value={node.borderRightWidth.toString()}
                          />
                        </OverrideResetAffordance>
                        <OverrideResetAffordance
                          className="flex-1"
                          label="border bottom width"
                          onReset={() =>
                            handleChange(
                              overrideReset.buildResetPatch(
                                borderBottomWidthKeys,
                              ) as Partial<BorderNode>,
                            )
                          }
                          show={showBorderWidthBottomReset}
                        >
                          <TextInput
                            icon={<SquareDashedTopSolidIcon className="rotate-180 size-3.5" />}
                            label="Border Bottom"
                            mixed={mixedKeys.has("borderBottomWidth")}
                            minValue={0}
                            onChange={(value) =>
                              handleDraftChange({
                                borderBottomWidth: Number(value),
                              })
                            }
                            onCommit={handleCommit}
                            type="number"
                            typeNumberStepIncrement={1}
                            validator={Schema.String}
                            value={node.borderBottomWidth.toString()}
                          />
                        </OverrideResetAffordance>
                      </div>
                    </div>
                  )}

                  <Button
                    size="icon-sm"
                    variant="secondary"
                    onClick={() => (showIndividualBorder ? collapseBorder() : expandBorder())}
                  >
                    {showIndividualBorder ? (
                      <VaultIcon className="size-3.5" />
                    ) : (
                      <FullscreenIcon className="size-3.5" />
                    )}
                  </Button>

                  <Button
                    onClick={() => handleChange({ borderEnabled: false })}
                    size="icon-sm"
                    variant="secondary"
                  >
                    <MinusIcon />
                  </Button>
                </div>
              </OverrideResetAffordance>
            </PanelSubSectionContent>
          </PanelSubSection>
          <OverrideResetAffordance
            label="border color"
            onReset={() =>
              handleChange(overrideReset.buildResetPatch(borderColorKeys) as Partial<BorderNode>)
            }
            show={showBorderColorReset}
          >
            <ColorInput
              mixed={mixedKeys.has("borderColor")}
              onChange={(value) => handleChange({ borderColor: value })}
              onCommit={commit}
              onDiscard={discard}
              onDragStart={begin}
              value={node.borderColor}
            />
          </OverrideResetAffordance>
        </PanelSectionContent>
      )}
    </PanelSection>
  );
}

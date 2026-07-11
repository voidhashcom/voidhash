"use client";

import type { FlexDirection } from "@voidhash/mimic-schema";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useDesignerDraft } from "@/features/studio/paywalls/designer/hooks/use-designer-draft";
import { Schema } from "effect";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  BetweenHorizontalStartIcon,
  FullscreenIcon,
  PanelBottomDashedIcon,
  PanelLeftDashedIcon,
  PanelLeftRightDashedIcon,
  PanelRightDashedIcon,
  PanelTopBottomDashedIcon,
  PanelTopDashedIcon,
  VaultIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useStore } from "zustand";

import { Button, ToggleGroup, ToggleGroupItem } from "@voidhash/ui";
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
  PanelSubSection,
  PanelSubSectionContent,
  PanelSubSectionTitle,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";
import { updateLayoutStyle } from "@/features/studio/paywalls/designer/state/actions";
import { usePaywallDesignerActions } from "@/features/studio/paywalls/designer/state/designer-store";

import { usePaywallDesignerStore } from "../../../state/designer-store";
import { getAlignItems, getFlexDirection } from "../../../state/utils/node-type-helpers";
import { getNodeById } from "../../../state/utils/nodes";
import { OverrideResetAffordance } from "../components/override-reset-affordance";
import { FlexAlignmentInput } from "../inputs/flex-alignment-input";
import { HeightInput } from "../inputs/height-input";
import { TextInput } from "../inputs/text-input";
import { WidthInput } from "../inputs/width-input";
import { useStyleTargets } from "../utils/get-style-targets";
import { type StyleOverrideResetContext } from "../utils/style-override-reset";
import { useStyleOverrideResetContext } from "../utils/use-style-override-reset-context";

type LayoutNode = {
  gap: number;
  justifyContent: string;
  alignItems: string;
  flexDirection: FlexDirection;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  width: unknown;
  height: unknown;
  flex: unknown;
  flexGrow: unknown;
  flexShrink: unknown;
  flexBasis: unknown;
  alignSelf: unknown;
};

export interface FlexLayoutSectionProps {
  nodes: SnapshotNode[];
  showDimensions?: boolean;
  editableDimensions?: boolean;
  parentId: string;
}

export function FlexLayoutSection({
  nodes,
  parentId,
  showDimensions = true,
  editableDimensions = true,
}: FlexLayoutSectionProps) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { style, targets, mixedKeys } = useStyleTargets(nodes);
  const overrideReset = useStyleOverrideResetContext(nodes);
  const { draft, begin, commit } = useDesignerDraft(store);

  const node = style as LayoutNode | null;
  const firstNodeId = nodes[0]?.id ?? null;

  const handleChange = useCallback(
    (incoming: Partial<LayoutNode>) => {
      dispatch(updateLayoutStyle)({ nodes: targets, style: incoming });
    },
    [dispatch, targets],
  );

  const handleDraftChange = useCallback(
    (incoming: Partial<LayoutNode>) => {
      if (!draft) begin();
      dispatch(updateLayoutStyle)({ nodes: targets, style: incoming });
    },
    [draft, begin, dispatch, targets],
  );

  const handleCommit = useCallback(() => {
    commit();
  }, [commit]);

  if (!node) return null;

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Layout</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        <FlexSubsection
          handleCommit={handleCommit}
          handleDraftChange={handleDraftChange}
          mixedKeys={mixedKeys}
          node={node}
          onNodeChange={handleChange}
          overrideReset={overrideReset}
        />
        {showDimensions && (
          <DimensionsSubSection
            editable={editableDimensions}
            handleCommit={handleCommit}
            handleDraftChange={handleDraftChange}
            node={node}
            nodeId={firstNodeId}
            onNodeChange={handleChange}
            overrideReset={overrideReset}
            parentId={parentId}
          />
        )}
        <PaddingSubSection
          handleCommit={handleCommit}
          handleDraftChange={handleDraftChange}
          mixedKeys={mixedKeys}
          node={node}
          onNodeChange={handleChange}
          overrideReset={overrideReset}
        />
      </PanelSectionContent>
    </PanelSection>
  );
}

// ===============================
// Dimensions
// ===============================
type DimensionsSubSectionProps = {
  node: LayoutNode;
  nodeId: string | null;
  onNodeChange: (style: Partial<LayoutNode>) => void;
  handleDraftChange: (style: Partial<LayoutNode>) => void;
  handleCommit: () => void;
  editable?: boolean;
  parentId: string;
  overrideReset: StyleOverrideResetContext;
};

function DimensionsSubSection({
  node,
  nodeId,
  onNodeChange,
  handleDraftChange,
  handleCommit,
  parentId,
  editable = true,
  overrideReset,
}: DimensionsSubSectionProps) {
  const store = usePaywallDesignerStore();
  const parent = useStore(store, (state) => getNodeById(state, parentId));
  const boundingBox = useStore(store, (state) =>
    nodeId ? state.canvas.boundingBoxes[nodeId] : null,
  );

  if (!parent) {
    return null;
  }
  const parentDirection = getFlexDirection(parent, "row");
  const parentAlignItems = getAlignItems(parent, "stretch");

  const computedWidth = boundingBox ? Math.round(boundingBox.width) : null;
  const computedHeight = boundingBox ? Math.round(boundingBox.height) : null;
  const widthKeys = ["width", "flex", "alignSelf"] as const;
  const heightKeys = ["height", "flex", "alignSelf"] as const;
  const showWidthReset = overrideReset.isOverrideModeActive && overrideReset.hasOverride(widthKeys);
  const showHeightReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(heightKeys);

  return (
    <PanelSubSection>
      <PanelSubSectionTitle>Dimensions</PanelSubSectionTitle>
      <PanelSubSectionContent>
        <div className="flex flex-row gap-2">
          <OverrideResetAffordance
            label="width"
            onReset={() =>
              onNodeChange(overrideReset.buildResetPatch(widthKeys) as Partial<LayoutNode>)
            }
            show={showWidthReset}
          >
            <WidthInput
              computedWidth={computedWidth}
              disabled={!editable}
              node={node as never}
              onCommit={handleCommit}
              onDraftChange={handleDraftChange as never}
              onNodeChange={onNodeChange as never}
              parentAlignItems={parentAlignItems}
              parentDirection={parentDirection}
            />
          </OverrideResetAffordance>
          <OverrideResetAffordance
            label="height"
            onReset={() =>
              onNodeChange(overrideReset.buildResetPatch(heightKeys) as Partial<LayoutNode>)
            }
            show={showHeightReset}
          >
            <HeightInput
              computedHeight={computedHeight}
              disabled={!editable}
              node={node as never}
              onCommit={handleCommit}
              onDraftChange={handleDraftChange as never}
              onNodeChange={onNodeChange as never}
              parentAlignItems={parentAlignItems}
              parentDirection={parentDirection}
            />
          </OverrideResetAffordance>
        </div>
      </PanelSubSectionContent>
    </PanelSubSection>
  );
}

// ===============================
// Flex
// ===============================
type FlexSubsectionProps = {
  node: LayoutNode;
  mixedKeys: Set<string>;
  onNodeChange: (style: Partial<LayoutNode>) => void;
  handleDraftChange: (updates: Partial<LayoutNode>) => void;
  handleCommit: () => void;
  overrideReset: StyleOverrideResetContext;
};

function FlexSubsection({
  node,
  mixedKeys,
  onNodeChange,
  handleDraftChange,
  handleCommit,
  overrideReset,
}: FlexSubsectionProps) {
  const directionKeys = ["flexDirection"] as const;
  const gapKeys = ["gap"] as const;
  const alignmentKeys = ["alignItems", "justifyContent"] as const;
  const showDirectionReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(directionKeys);
  const showGapReset = overrideReset.isOverrideModeActive && overrideReset.hasOverride(gapKeys);
  const showAlignmentReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(alignmentKeys);

  return (
    <PanelSubSection>
      <PanelSubSectionContent>
        <div className="flex flex-row gap-2">
          <div className="flex w-21 flex-col gap-2">
            <OverrideResetAffordance
              label="layout direction"
              onReset={() =>
                onNodeChange(overrideReset.buildResetPatch(directionKeys) as Partial<LayoutNode>)
              }
              show={showDirectionReset}
            >
              <ToggleGroup
                variant="outline"
                size="sm"
                className="w-full"
                onValueChange={(value) => onNodeChange({ flexDirection: value as FlexDirection })}
                type="single"
                value={mixedKeys.has("flexDirection") ? undefined : node.flexDirection}
              >
                <ToggleGroupItem size="sm" className="flex-1 min-w-7 px-2" value="column">
                  <ArrowDownIcon className="size-3.5" />
                </ToggleGroupItem>
                <ToggleGroupItem size="sm" className="flex-1 min-w-7 px-2" value="row">
                  <ArrowRightIcon className="size-3.5" />
                </ToggleGroupItem>
              </ToggleGroup>
            </OverrideResetAffordance>
            <OverrideResetAffordance
              label="layout gap"
              onReset={() =>
                onNodeChange(overrideReset.buildResetPatch(gapKeys) as Partial<LayoutNode>)
              }
              show={showGapReset}
            >
              <TextInput
                icon={<BetweenHorizontalStartIcon className="size-3.5" />}
                label="Gap"
                mixed={mixedKeys.has("gap")}
                onChange={(value) => handleDraftChange({ gap: Number(value) })}
                onCommit={handleCommit}
                type="number"
                typeNumberStepIncrement={1}
                validator={Schema.String}
                value={node.gap.toString()}
              />
            </OverrideResetAffordance>
          </div>
          <OverrideResetAffordance
            className="flex flex-1 min-w-0 items-stretch gap-2 self-stretch"
            label="layout alignment"
            onReset={() =>
              onNodeChange(overrideReset.buildResetPatch(alignmentKeys) as Partial<LayoutNode>)
            }
            show={showAlignmentReset}
          >
            <FlexAlignmentInput
              alignItems={node.alignItems as never}
              flexDirection={node.flexDirection}
              justifyContent={node.justifyContent as never}
              onChange={(value) =>
                onNodeChange({
                  alignItems: value.alignItems,
                  justifyContent: value.justifyContent,
                })
              }
            />
          </OverrideResetAffordance>
        </div>
      </PanelSubSectionContent>
    </PanelSubSection>
  );
}

// ===============================
// Padding Sub Section
// ===============================
type PaddingSubSectionProps = {
  node: LayoutNode;
  mixedKeys: Set<string>;
  onNodeChange: (style: Partial<LayoutNode>) => void;
  handleDraftChange: (updates: Partial<LayoutNode>) => void;
  handleCommit: () => void;
  overrideReset: StyleOverrideResetContext;
};

function shouldShowIndividualPadding(node: LayoutNode) {
  return node.paddingTop !== node.paddingBottom || node.paddingLeft !== node.paddingRight;
}

function PaddingSubSection({
  node,
  mixedKeys,
  onNodeChange,
  handleDraftChange,
  handleCommit,
  overrideReset,
}: PaddingSubSectionProps) {
  const [showIndividualPadding, setShowIndividualPadding] = useState(
    shouldShowIndividualPadding(node) ||
      mixedKeys.has("paddingLeft") ||
      mixedKeys.has("paddingRight") ||
      mixedKeys.has("paddingTop") ||
      mixedKeys.has("paddingBottom"),
  );

  const expandPadding = () => {
    setShowIndividualPadding(true);
  };

  const collapsePadding = () => {
    setShowIndividualPadding(false);
    onNodeChange({
      paddingLeft: node.paddingLeft,
      paddingRight: node.paddingLeft,
      paddingTop: node.paddingTop,
      paddingBottom: node.paddingTop,
    });
  };

  const paddingLeftKeys = ["paddingLeft"] as const;
  const paddingTopKeys = ["paddingTop"] as const;
  const paddingRightKeys = ["paddingRight"] as const;
  const paddingBottomKeys = ["paddingBottom"] as const;
  const paddingHorizontalKeys = ["paddingLeft", "paddingRight"] as const;
  const paddingVerticalKeys = ["paddingTop", "paddingBottom"] as const;

  const showPaddingLeftReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(paddingLeftKeys);
  const showPaddingTopReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(paddingTopKeys);
  const showPaddingRightReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(paddingRightKeys);
  const showPaddingBottomReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(paddingBottomKeys);
  const showPaddingHorizontalReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(paddingHorizontalKeys);
  const showPaddingVerticalReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(paddingVerticalKeys);

  return (
    <PanelSubSection>
      <PanelSubSectionTitle>Padding</PanelSubSectionTitle>
      <PanelSubSectionContent>
        <div className="flex flex-row gap-2">
          {showIndividualPadding && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-row gap-2">
                <OverrideResetAffordance
                  label="padding left"
                  onReset={() =>
                    onNodeChange(
                      overrideReset.buildResetPatch(paddingLeftKeys) as Partial<LayoutNode>,
                    )
                  }
                  show={showPaddingLeftReset}
                >
                  <TextInput
                    icon={<PanelLeftDashedIcon className="size-3.5" />}
                    label="Padding Left"
                    mixed={mixedKeys.has("paddingLeft")}
                    onChange={(value) => handleDraftChange({ paddingLeft: Number(value) })}
                    onCommit={handleCommit}
                    type="number"
                    typeNumberStepIncrement={1}
                    validator={Schema.String}
                    value={node.paddingLeft.toString()}
                  />
                </OverrideResetAffordance>
                <OverrideResetAffordance
                  label="padding top"
                  onReset={() =>
                    onNodeChange(
                      overrideReset.buildResetPatch(paddingTopKeys) as Partial<LayoutNode>,
                    )
                  }
                  show={showPaddingTopReset}
                >
                  <TextInput
                    icon={<PanelTopDashedIcon className="size-3.5" />}
                    label="Padding Top"
                    mixed={mixedKeys.has("paddingTop")}
                    onChange={(value) => handleDraftChange({ paddingTop: Number(value) })}
                    onCommit={handleCommit}
                    type="number"
                    typeNumberStepIncrement={1}
                    validator={Schema.String}
                    value={node.paddingTop.toString()}
                  />
                </OverrideResetAffordance>
              </div>
              <div className="flex flex-row gap-2">
                <OverrideResetAffordance
                  label="padding right"
                  onReset={() =>
                    onNodeChange(
                      overrideReset.buildResetPatch(paddingRightKeys) as Partial<LayoutNode>,
                    )
                  }
                  show={showPaddingRightReset}
                >
                  <TextInput
                    icon={<PanelRightDashedIcon className="size-3.5" />}
                    label="Padding Right"
                    mixed={mixedKeys.has("paddingRight")}
                    onChange={(value) => handleDraftChange({ paddingRight: Number(value) })}
                    onCommit={handleCommit}
                    type="number"
                    typeNumberStepIncrement={1}
                    validator={Schema.String}
                    value={node.paddingRight.toString()}
                  />
                </OverrideResetAffordance>

                <OverrideResetAffordance
                  label="padding bottom"
                  onReset={() =>
                    onNodeChange(
                      overrideReset.buildResetPatch(paddingBottomKeys) as Partial<LayoutNode>,
                    )
                  }
                  show={showPaddingBottomReset}
                >
                  <TextInput
                    icon={<PanelBottomDashedIcon className="size-3.5" />}
                    label="Padding Bottom"
                    mixed={mixedKeys.has("paddingBottom")}
                    onChange={(value) => handleDraftChange({ paddingBottom: Number(value) })}
                    onCommit={handleCommit}
                    type="number"
                    typeNumberStepIncrement={1}
                    validator={Schema.String}
                    value={node.paddingBottom.toString()}
                  />
                </OverrideResetAffordance>
              </div>
            </div>
          )}

          {!showIndividualPadding && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-row gap-2">
                <OverrideResetAffordance
                  label="padding horizontal"
                  onReset={() =>
                    onNodeChange(
                      overrideReset.buildResetPatch(paddingHorizontalKeys) as Partial<LayoutNode>,
                    )
                  }
                  show={showPaddingHorizontalReset}
                >
                  <TextInput
                    icon={<PanelLeftRightDashedIcon className="size-3.5" />}
                    label="Padding Horizontal"
                    mixed={mixedKeys.has("paddingLeft") || mixedKeys.has("paddingRight")}
                    onChange={(value) =>
                      handleDraftChange({
                        paddingLeft: Number(value),
                        paddingRight: Number(value),
                      })
                    }
                    onCommit={handleCommit}
                    type="number"
                    typeNumberStepIncrement={1}
                    validator={Schema.String}
                    value={node.paddingLeft.toString()}
                  />
                </OverrideResetAffordance>
                <OverrideResetAffordance
                  label="padding vertical"
                  onReset={() =>
                    onNodeChange(
                      overrideReset.buildResetPatch(paddingVerticalKeys) as Partial<LayoutNode>,
                    )
                  }
                  show={showPaddingVerticalReset}
                >
                  <TextInput
                    icon={<PanelTopBottomDashedIcon className="size-3.5" />}
                    label="Padding Top"
                    mixed={mixedKeys.has("paddingTop") || mixedKeys.has("paddingBottom")}
                    onChange={(value) =>
                      handleDraftChange({
                        paddingTop: Number(value),
                        paddingBottom: Number(value),
                      })
                    }
                    onCommit={handleCommit}
                    type="number"
                    typeNumberStepIncrement={1}
                    validator={Schema.String}
                    value={node.paddingTop.toString()}
                  />
                </OverrideResetAffordance>
              </div>
            </div>
          )}

          <Button
            onClick={() => (showIndividualPadding ? collapsePadding() : expandPadding())}
            size="icon-sm"
            variant="secondary"
          >
            {showIndividualPadding ? (
              <VaultIcon className="size-3.5" />
            ) : (
              <FullscreenIcon className="size-3.5" />
            )}
          </Button>
        </div>
      </PanelSubSectionContent>
    </PanelSubSection>
  );
}

"use client";

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import type { FontWeight, TextAlign } from "@voidhash/mimic-schema";
import { useDesignerDraft } from "@/features/studio/paywalls/designer/hooks/use-designer-draft";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from "@voidhash/ui";
import { Schema } from "effect";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BookTypeIcon,
  ChevronDownIcon,
  TypeIcon,
} from "lucide-react";
import { useCallback } from "react";

import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
  PanelSubSection,
  PanelSubSectionContent,
  PanelSubSectionTitle,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";
import { SelectInput } from "@/features/studio/paywalls/designer/components/ui/select-input";
import { updateTypographyStyle } from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";

import { OverrideResetAffordance } from "../components/override-reset-affordance";
import { TextInput } from "../inputs/text-input";
import { useStyleTargets } from "../utils/get-style-targets";
import { useStyleOverrideResetContext } from "../utils/use-style-override-reset-context";

type TypographyNode = {
  fontSize: number;
  fontWeight: FontWeight;
  textAlign: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  color: string;
};

const FONT_WEIGHT_OPTIONS: { value: FontWeight; label: string }[] = [
  { label: "Thin", value: "100" },
  { label: "Extra Light", value: "200" },
  { label: "Light", value: "300" },
  { label: "Regular", value: "400" },
  { label: "Medium", value: "500" },
  { label: "Semibold", value: "600" },
  { label: "Bold", value: "700" },
  { label: "Extra Bold", value: "800" },
  { label: "Black", value: "900" },
];

const FONT_FAMILY_OPTIONS: { value: string; label: string }[] = [
  { label: "Default", value: "geist-variable" },
];

export function TypographySection({ nodes }: { nodes: SnapshotNode[] }) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { style, targets, mixedKeys } = useStyleTargets(nodes);
  const overrideReset = useStyleOverrideResetContext(nodes);
  const { draft, begin, commit } = useDesignerDraft(store);

  const node = style as TypographyNode | null;
  const fontWeightKeys = ["fontWeight"] as const;
  const fontSizeKeys = ["fontSize"] as const;
  const lineHeightKeys = ["lineHeight"] as const;
  const letterSpacingKeys = ["letterSpacing"] as const;
  const textAlignKeys = ["textAlign"] as const;

  const handleChange = useCallback(
    (incoming: Partial<TypographyNode>) => {
      dispatch(updateTypographyStyle)({ nodes: targets, style: incoming });
    },
    [dispatch, targets],
  );

  const handleDraftChange = useCallback(
    (incoming: Partial<TypographyNode>) => {
      if (!draft) begin();
      dispatch(updateTypographyStyle)({ nodes: targets, style: incoming });
    },
    [draft, begin, dispatch, targets],
  );

  const handleCommit = useCallback(() => {
    commit();
  }, [commit]);

  if (!node) return null;

  const isLineHeightAuto = node.lineHeight === 0;
  const showFontWeightReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(fontWeightKeys);
  const showFontSizeReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(fontSizeKeys);
  const showLineHeightReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(lineHeightKeys);
  const showLetterSpacingReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(letterSpacingKeys);
  const showTextAlignReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(textAlignKeys);

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Typography</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        <div className="flex flex-col gap-2">
          <SelectInput
            disabled={true}
            icon={<BookTypeIcon className="size-3.5" />}
            label="Font Family"
            onChange={() => {
              // Do nothing
            }}
            options={FONT_FAMILY_OPTIONS}
            placeholder="Default"
            value={FONT_FAMILY_OPTIONS[0]?.value ?? ""}
          />

          <div className="flex flex-row gap-2">
            <OverrideResetAffordance
              className="flex-1"
              label="font weight"
              onReset={() =>
                handleChange(
                  overrideReset.buildResetPatch(fontWeightKeys) as Partial<TypographyNode>,
                )
              }
              show={showFontWeightReset}
            >
              <SelectInput
                icon={<div className="font-bold text-xs">W</div>}
                label="Font Weight"
                mixed={mixedKeys.has("fontWeight")}
                onChange={(value) => handleChange({ fontWeight: value as FontWeight })}
                options={FONT_WEIGHT_OPTIONS}
                value={node.fontWeight}
              />
            </OverrideResetAffordance>
            <OverrideResetAffordance
              className="flex-1"
              label="font size"
              onReset={() =>
                handleChange(overrideReset.buildResetPatch(fontSizeKeys) as Partial<TypographyNode>)
              }
              show={showFontSizeReset}
            >
              <TextInput
                icon={<TypeIcon className="size-3.5" />}
                label="Font Size"
                mixed={mixedKeys.has("fontSize")}
                minValue={1}
                onChange={(value) => handleDraftChange({ fontSize: Number(value) })}
                onCommit={handleCommit}
                type="number"
                typeNumberStepIncrement={1}
                validator={Schema.String}
                value={node.fontSize.toString()}
              />
            </OverrideResetAffordance>
          </div>

          <div className="flex flex-row gap-2">
            <OverrideResetAffordance
              className="flex-1"
              label="line height"
              onReset={() =>
                handleChange(
                  overrideReset.buildResetPatch(lineHeightKeys) as Partial<TypographyNode>,
                )
              }
              show={showLineHeightReset}
            >
              <TextInput
                disabled={isLineHeightAuto}
                icon={<div className="text-xs">A</div>}
                label="Line Height"
                mixed={mixedKeys.has("lineHeight")}
                minValue={0.5}
                onChange={(value) => handleDraftChange({ lineHeight: Number(value) })}
                onCommit={handleCommit}
                trailing={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="bg-transparent pr-3 dark:bg-transparent"
                        size="sm"
                        variant="secondary"
                      >
                        {isLineHeightAuto ? (
                          <div className="font-bold text-xs">Auto</div>
                        ) : (
                          <ChevronDownIcon className="size-3.5" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => handleChange({ lineHeight: 0 })}>
                        Auto
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          handleChange({
                            lineHeight: isLineHeightAuto ? 1.5 : node.lineHeight,
                          })
                        }
                      >
                        Fixed ({isLineHeightAuto ? "1.5" : node.lineHeight.toFixed(1)})
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
                type="number"
                typeNumberStepIncrement={0.1}
                validator={Schema.String}
                value={isLineHeightAuto ? "Auto" : node.lineHeight.toString()}
              />
            </OverrideResetAffordance>
            <OverrideResetAffordance
              className="flex-1"
              label="letter spacing"
              onReset={() =>
                handleChange(
                  overrideReset.buildResetPatch(letterSpacingKeys) as Partial<TypographyNode>,
                )
              }
              show={showLetterSpacingReset}
            >
              <TextInput
                icon={<div className="font-mono text-xs">|A|</div>}
                label="Letter Spacing"
                mixed={mixedKeys.has("letterSpacing")}
                onChange={(value) => handleDraftChange({ letterSpacing: Number(value) })}
                onCommit={handleCommit}
                type="number"
                typeNumberStepIncrement={0.1}
                validator={Schema.String}
                value={node.letterSpacing.toString()}
              />
            </OverrideResetAffordance>
          </div>
        </div>

        <PanelSubSection>
          <PanelSubSectionTitle>Alignment</PanelSubSectionTitle>
          <PanelSubSectionContent>
            <div className="flex flex-row items-center gap-2">
              <OverrideResetAffordance
                label="text align"
                onReset={() =>
                  handleChange(
                    overrideReset.buildResetPatch(textAlignKeys) as Partial<TypographyNode>,
                  )
                }
                show={showTextAlignReset}
              >
                <ToggleGroup
                  variant="outline"
                  size="sm"
                  onValueChange={(value) => {
                    if (value) {
                      handleChange({ textAlign: value as TextAlign });
                    }
                  }}
                  type="single"
                  value={mixedKeys.has("textAlign") ? undefined : node.textAlign}
                >
                  <ToggleGroupItem size="sm" className="min-w-7 px-2" value="left">
                    <AlignLeft className="size-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem size="sm" className="min-w-7 px-2" value="center">
                    <AlignCenter className="size-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem size="sm" className="min-w-7 px-2" value="right">
                    <AlignRight className="size-3.5" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </OverrideResetAffordance>
            </div>
          </PanelSubSectionContent>
        </PanelSubSection>
      </PanelSectionContent>
    </PanelSection>
  );
}

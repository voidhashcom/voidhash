"use client";

/**
 * Built-in panel definition for typography and alignment controls.
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` + header "Typography" → `Panel.Section title="Typography"`.
 * - Font Family `SelectInput` (disabled, single "Default" option) →
 *   `Panel.SelectField disabled` (a verbatim dead control).
 * - A `flex-row` of Font Weight `SelectInput` + Font Size `TextInput` →
 *   `Panel.Row` > two fields.
 * - A `flex-row` of Line Height `TextInput` (with an Auto/Fixed trailing menu) +
 *   Letter Spacing `TextInput` → `Panel.Row` > two fields.
 * - An `Alignment` `PanelSubSection` with a text-align `ToggleGroup` →
 *   `Panel.Subsection title="Alignment"` > `Panel.ToggleGroup`.
 *
 * Behavior (identical to the old section):
 * - fontSize/lineHeight/letterSpacing are DRAFT gestures (begin-on-first-change →
 *   live write → commit); fontWeight and textAlign are DIRECT writes.
 * - `lineHeight === 0` means Auto: the field is disabled and shows "Auto"; the
 *   trailing menu's "Auto" writes `lineHeight: 0`, "Fixed" writes `1.5` when
 *   currently Auto else keeps the current value.
 * - textAlign is `mixed` → the toggle shows no selection (renderer maps the wire
 *   `mixed` flag to an empty value, like the old `value={mixed ? undefined : v}`).
 * - Five single-key reset affordances: fontWeight, fontSize, lineHeight,
 *   letterSpacing, textAlign.
 *
 * PARITY COMPROMISES (wire limitations, not the section's intent): none — the
 * Font Family / Font Weight selects carry their glyphs via `selectField.icon`,
 * and textAlign renders the `alignLeft`/`alignCenter`/`alignRight` icon tokens.
 */
import type { FontWeight, TextAlign } from "@voidhash/mimic-schema";
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import { useCallback } from "react";

import { useDesignerDraft } from "../../../hooks/use-designer-draft";
import { updateTypographyStyle } from "../../../state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "../../../state/designer-store";
import { useStyleOverrideResetContext } from "../utils/use-style-override-reset-context";
import { useDefinitionNodes } from "./use-definition-nodes";

interface TypographyStyle {
  fontSize: number;
  fontWeight: FontWeight;
  textAlign: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  color: string;
}

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

const FONT_FAMILY_OPTIONS = [{ label: "Default", value: "geist-variable" }] as const;

const TEXT_ALIGN_OPTIONS = [
  { value: "left", icon: "alignLeft", label: "Left" },
  { value: "center", icon: "alignCenter", label: "Center" },
  { value: "right", icon: "alignRight", label: "Right" },
] as const;

const FONT_WEIGHT_KEYS = ["fontWeight"] as const;
const FONT_SIZE_KEYS = ["fontSize"] as const;
const LINE_HEIGHT_KEYS = ["lineHeight"] as const;
const LETTER_SPACING_KEYS = ["letterSpacing"] as const;
const TEXT_ALIGN_KEYS = ["textAlign"] as const;

/** The `Typography` panel definition. */
export function TypographyPanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { nodes, style, targets, mixedKeys } = useDefinitionNodes();
  const overrideReset = useStyleOverrideResetContext(nodes);
  const { draft, begin, commit } = useDesignerDraft(store);

  const node = style as TypographyStyle | null;

  const handleChange = useCallback(
    (incoming: Partial<TypographyStyle>) => {
      dispatch(updateTypographyStyle)({ nodes: targets, style: incoming });
    },
    [dispatch, targets],
  );

  const handleDraftChange = useCallback(
    (incoming: Partial<TypographyStyle>) => {
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
  const active = overrideReset.isOverrideModeActive;
  const reset = (keys: readonly string[]) =>
    handleChange(overrideReset.buildResetPatch(keys) as Partial<TypographyStyle>);

  return (
    <Panel>
      <Panel.Section title="Typography">
        <Panel.Column>
          <Panel.SelectField
            disabled
            icon="type"
            placeholder="Default"
            options={FONT_FAMILY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={FONT_FAMILY_OPTIONS[0]?.value ?? ""}
            onChange={() => {
              // Dead control — the section renders it disabled.
            }}
          />

          <Panel.Row align="stretch">
            <Panel.ResetAffordance
              label="font weight"
              show={active && overrideReset.hasOverride(FONT_WEIGHT_KEYS)}
              onReset={() => reset(FONT_WEIGHT_KEYS)}
            >
              <Panel.SelectField
                icon="a"
                placeholder="Font Weight"
                mixed={mixedKeys.has("fontWeight")}
                options={FONT_WEIGHT_OPTIONS}
                value={node.fontWeight}
                onChange={(value) => handleChange({ fontWeight: value as FontWeight })}
              />
            </Panel.ResetAffordance>
            <Panel.ResetAffordance
              label="font size"
              show={active && overrideReset.hasOverride(FONT_SIZE_KEYS)}
              onReset={() => reset(FONT_SIZE_KEYS)}
            >
              <Panel.TextField
                kind="number"
                icon="type"
                min={1}
                step={1}
                placeholder="Font Size"
                mixed={mixedKeys.has("fontSize")}
                value={node.fontSize.toString()}
                onChange={(value) => handleDraftChange({ fontSize: Number(value) })}
                onCommit={handleCommit}
              />
            </Panel.ResetAffordance>
          </Panel.Row>

          <Panel.Row align="stretch">
            <Panel.ResetAffordance
              label="line height"
              show={active && overrideReset.hasOverride(LINE_HEIGHT_KEYS)}
              onReset={() => reset(LINE_HEIGHT_KEYS)}
            >
              <Panel.TextField
                kind="number"
                icon="a"
                min={0.5}
                step={0.1}
                placeholder="Line Height"
                disabled={isLineHeightAuto}
                mixed={mixedKeys.has("lineHeight")}
                value={isLineHeightAuto ? "Auto" : node.lineHeight.toString()}
                trailingMenu={{
                  items: [
                    { value: "auto", label: "Auto" },
                    {
                      value: "fixed",
                      label: `Fixed (${isLineHeightAuto ? "1.5" : node.lineHeight.toFixed(1)})`,
                    },
                  ],
                }}
                onChange={(value) => handleDraftChange({ lineHeight: Number(value) })}
                onCommit={handleCommit}
                onTrailingSelect={(value) => {
                  if (value === "auto") {
                    handleChange({ lineHeight: 0 });
                  } else {
                    handleChange({ lineHeight: isLineHeightAuto ? 1.5 : node.lineHeight });
                  }
                }}
              />
            </Panel.ResetAffordance>
            <Panel.ResetAffordance
              label="letter spacing"
              show={active && overrideReset.hasOverride(LETTER_SPACING_KEYS)}
              onReset={() => reset(LETTER_SPACING_KEYS)}
            >
              <Panel.TextField
                kind="number"
                step={0.1}
                placeholder="Letter Spacing"
                mixed={mixedKeys.has("letterSpacing")}
                value={node.letterSpacing.toString()}
                onChange={(value) => handleDraftChange({ letterSpacing: Number(value) })}
                onCommit={handleCommit}
              />
            </Panel.ResetAffordance>
          </Panel.Row>
        </Panel.Column>

        <Panel.Subsection title="Alignment">
          <Panel.ResetAffordance
            label="text align"
            show={active && overrideReset.hasOverride(TEXT_ALIGN_KEYS)}
            onReset={() => reset(TEXT_ALIGN_KEYS)}
          >
            <Panel.ToggleGroup
              value={node.textAlign}
              mixed={mixedKeys.has("textAlign")}
              options={TEXT_ALIGN_OPTIONS.map((o) => ({ value: o.value, icon: o.icon }))}
              width="full"
              onChange={(value) => handleChange({ textAlign: value as TextAlign })}
            />
          </Panel.ResetAffordance>
        </Panel.Subsection>
      </Panel.Section>
    </Panel>
  );
}

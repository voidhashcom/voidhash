"use client";

/**
 * Built-in panel definition for border width, color, enablement, and resets.
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` + header "Border" → `Panel.Section title="Border"`.
 * - When the border is disabled (and not mixed) the header hosts a `+` enable
 *   `Button`, wrapped in the "border enabled" `OverrideResetAffordance` (all six
 *   border keys) → `Panel.SectionActions` > `Panel.ResetAffordance` >
 *   `Panel.Button icon="plus"` (hoisted into the header by the renderer).
 * - When enabled (or mixed) the body renders a `Width` subsection wrapped in the
 *   same "border enabled" reset affordance, containing: the width input(s), the
 *   expand/collapse `Button`, and the `−` disable `Button` — then a `borderColor`
 *   `ColorInput` in its own reset affordance.
 * - Width is UNIFORM (one number field, `squareDashedTopSolid` icon) or EXPANDED
 *   (four per-side fields with rotated `squareDashedTopSolid*` icons in a 2×2 grid).
 *
 * State + gesture discipline (identical to the old section):
 * - `showIndividualBorder` is seeded ONLY from {@link shouldShowIndividualBorder}
 *   — deliberately WITHOUT the mixed-key check (verbatim asymmetry vs the border-
 *   radius panel; inventory anomaly 5). Seeded once per mount.
 * - Width typing/scrub is a DRAFT gesture; collapse-to-uniform, enable/disable,
 *   and expand/collapse are DIRECT writes. The color is a DRAFT gesture
 *   (begin/commit/discard).
 * - Reset hierarchy EXACTLY: `showBorderEnabledReset` (all six keys) SHORT-CIRCUITS
 *   the finer resets — width-all > four individual widths > border-color are each
 *   gated on `!showBorderEnabledReset`.
 */
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import { useCallback, useState } from "react";

import { useDesignerDraft } from "../../../hooks/use-designer-draft";
import { updateBorderStyle } from "../../../state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "../../../state/designer-store";
import { useStyleOverrideResetContext } from "../utils/use-style-override-reset-context";
import { useDefinitionNodes } from "./use-definition-nodes";

interface BorderStyle {
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  borderColor: string;
  borderStyle: string;
  borderEnabled: boolean;
}

/**
 * Whether the four side widths diverge, seeding the expanded view.
 */
function shouldShowIndividualBorder(node: BorderStyle): boolean {
  return (
    node.borderTopWidth !== node.borderBottomWidth ||
    node.borderTopWidth !== node.borderLeftWidth ||
    node.borderTopWidth !== node.borderRightWidth ||
    node.borderBottomWidth !== node.borderLeftWidth ||
    node.borderBottomWidth !== node.borderRightWidth ||
    node.borderLeftWidth !== node.borderRightWidth
  );
}

const ENABLED_KEYS = ["borderEnabled"] as const;
const WIDTH_ALL_KEYS = [
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
] as const;
const LEFT_WIDTH_KEYS = ["borderLeftWidth"] as const;
const TOP_WIDTH_KEYS = ["borderTopWidth"] as const;
const RIGHT_WIDTH_KEYS = ["borderRightWidth"] as const;
const BOTTOM_WIDTH_KEYS = ["borderBottomWidth"] as const;
const COLOR_KEYS = ["borderColor"] as const;
// The full set the "border enabled" reset restores (its onReset payload).
const RELATED_KEYS = [
  "borderEnabled",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderColor",
] as const;

/** The `Border` panel definition. */
export function BorderPanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { nodes, style, targets, mixedKeys } = useDefinitionNodes();
  const overrideReset = useStyleOverrideResetContext(nodes);
  const { draft, begin, commit, discard } = useDesignerDraft(store);

  const node = style as BorderStyle | null;
  const isBorderEnabledMixed = mixedKeys.has("borderEnabled");

  // Seeded ONLY from the divergence helper — NO mixed-key seed (verbatim
  // asymmetry vs the border-radius panel). Once per mount.
  const [showIndividual, setShowIndividual] = useState<boolean>(() => {
    if (!node) return false;
    return shouldShowIndividualBorder(node);
  });

  const handleChange = useCallback(
    (incoming: Partial<BorderStyle>) => {
      dispatch(updateBorderStyle)({ nodes: targets, style: incoming });
    },
    [dispatch, targets],
  );

  const handleDraftChange = useCallback(
    (incoming: Partial<BorderStyle>) => {
      if (!draft) begin();
      dispatch(updateBorderStyle)({ nodes: targets, style: incoming });
    },
    [draft, begin, dispatch, targets],
  );

  const handleCommit = useCallback(() => {
    commit();
  }, [commit]);

  const collapse = useCallback(() => {
    if (!node) return;
    setShowIndividual(false);
    const uniform = node.borderTopWidth;
    handleChange({
      borderLeftWidth: uniform,
      borderRightWidth: uniform,
      borderTopWidth: uniform,
      borderBottomWidth: uniform,
    });
  }, [node, handleChange]);

  if (!node) return null;

  const active = overrideReset.isOverrideModeActive;
  const showEnabledReset = active && overrideReset.hasOverride(ENABLED_KEYS);
  const showWidthAllReset =
    !showEnabledReset && active && overrideReset.hasOverride(WIDTH_ALL_KEYS);
  const showWidthLeftReset =
    !showEnabledReset && active && overrideReset.hasOverride(LEFT_WIDTH_KEYS);
  const showWidthTopReset =
    !showEnabledReset && active && overrideReset.hasOverride(TOP_WIDTH_KEYS);
  const showWidthRightReset =
    !showEnabledReset && active && overrideReset.hasOverride(RIGHT_WIDTH_KEYS);
  const showWidthBottomReset =
    !showEnabledReset && active && overrideReset.hasOverride(BOTTOM_WIDTH_KEYS);
  const showColorReset =
    !showEnabledReset && active && overrideReset.hasOverride(COLOR_KEYS);

  const resetEnabled = () =>
    handleChange(overrideReset.buildResetPatch(RELATED_KEYS) as Partial<BorderStyle>);

  const anyWidthMixed =
    mixedKeys.has("borderTopWidth") ||
    mixedKeys.has("borderRightWidth") ||
    mixedKeys.has("borderBottomWidth") ||
    mixedKeys.has("borderLeftWidth");

  return (
    <Panel>
      <Panel.Section title="Border">
        {!node.borderEnabled && !isBorderEnabledMixed && (
          <Panel.SectionActions>
            <Panel.ResetAffordance
              label="border enabled"
              show={showEnabledReset}
              onReset={resetEnabled}
            >
              <Panel.Button
                icon="plus"
                size="icon-sm"
                onClick={() => handleChange({ borderEnabled: true })}
              />
            </Panel.ResetAffordance>
          </Panel.SectionActions>
        )}
        {(node.borderEnabled || isBorderEnabledMixed) && (
          <>
            <Panel.Subsection title="Width">
              <Panel.ResetAffordance
                label="border enabled"
                show={showEnabledReset}
                onReset={resetEnabled}
              >
                <Panel.Row align="stretch">
                  {!showIndividual && (
                    <Panel.ResetAffordance
                      label="border width"
                      show={showWidthAllReset}
                      onReset={() =>
                        handleChange(
                          overrideReset.buildResetPatch(WIDTH_ALL_KEYS) as Partial<BorderStyle>,
                        )
                      }
                    >
                      <Panel.TextField
                        kind="number"
                        icon="square"
                        min={0}
                        step={1}
                        placeholder="Width"
                        mixed={anyWidthMixed}
                        value={node.borderTopWidth.toString()}
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
                      />
                    </Panel.ResetAffordance>
                  )}

                  {showIndividual && (
                    <Panel.Column>
                      <Panel.Row align="stretch">
                        <Panel.ResetAffordance
                          label="border left width"
                          show={showWidthLeftReset}
                          onReset={() =>
                            handleChange(
                              overrideReset.buildResetPatch(LEFT_WIDTH_KEYS) as Partial<BorderStyle>,
                            )
                          }
                        >
                          <Panel.TextField
                            kind="number"
                            icon="squareDashedTopSolidLeft"
                            min={0}
                            step={1}
                            placeholder="Border Left"
                            mixed={mixedKeys.has("borderLeftWidth")}
                            value={node.borderLeftWidth.toString()}
                            onChange={(value) =>
                              handleDraftChange({ borderLeftWidth: Number(value) })
                            }
                            onCommit={handleCommit}
                          />
                        </Panel.ResetAffordance>
                        <Panel.ResetAffordance
                          label="border top width"
                          show={showWidthTopReset}
                          onReset={() =>
                            handleChange(
                              overrideReset.buildResetPatch(TOP_WIDTH_KEYS) as Partial<BorderStyle>,
                            )
                          }
                        >
                          <Panel.TextField
                            kind="number"
                            icon="squareDashedTopSolid"
                            min={0}
                            step={1}
                            placeholder="Border Top"
                            mixed={mixedKeys.has("borderTopWidth")}
                            value={node.borderTopWidth.toString()}
                            onChange={(value) =>
                              handleDraftChange({ borderTopWidth: Number(value) })
                            }
                            onCommit={handleCommit}
                          />
                        </Panel.ResetAffordance>
                      </Panel.Row>
                      <Panel.Row align="stretch">
                        <Panel.ResetAffordance
                          label="border right width"
                          show={showWidthRightReset}
                          onReset={() =>
                            handleChange(
                              overrideReset.buildResetPatch(
                                RIGHT_WIDTH_KEYS,
                              ) as Partial<BorderStyle>,
                            )
                          }
                        >
                          <Panel.TextField
                            kind="number"
                            icon="squareDashedTopSolidRight"
                            min={0}
                            step={1}
                            placeholder="Border Right"
                            mixed={mixedKeys.has("borderRightWidth")}
                            value={node.borderRightWidth.toString()}
                            onChange={(value) =>
                              handleDraftChange({ borderRightWidth: Number(value) })
                            }
                            onCommit={handleCommit}
                          />
                        </Panel.ResetAffordance>
                        <Panel.ResetAffordance
                          label="border bottom width"
                          show={showWidthBottomReset}
                          onReset={() =>
                            handleChange(
                              overrideReset.buildResetPatch(
                                BOTTOM_WIDTH_KEYS,
                              ) as Partial<BorderStyle>,
                            )
                          }
                        >
                          <Panel.TextField
                            kind="number"
                            icon="squareDashedTopSolidBottom"
                            min={0}
                            step={1}
                            placeholder="Border Bottom"
                            mixed={mixedKeys.has("borderBottomWidth")}
                            value={node.borderBottomWidth.toString()}
                            onChange={(value) =>
                              handleDraftChange({ borderBottomWidth: Number(value) })
                            }
                            onCommit={handleCommit}
                          />
                        </Panel.ResetAffordance>
                      </Panel.Row>
                    </Panel.Column>
                  )}

                  <Panel.Button
                    icon={showIndividual ? "vault" : "fullscreen"}
                    size="icon-sm"
                    onClick={() => (showIndividual ? collapse() : setShowIndividual(true))}
                  />
                  <Panel.Button
                    icon="minus"
                    size="icon-sm"
                    onClick={() => handleChange({ borderEnabled: false })}
                  />
                </Panel.Row>
              </Panel.ResetAffordance>
            </Panel.Subsection>
            <Panel.ResetAffordance
              label="border color"
              show={showColorReset}
              onReset={() =>
                handleChange(overrideReset.buildResetPatch(COLOR_KEYS) as Partial<BorderStyle>)
              }
            >
              <Panel.ColorField
                value={node.borderColor}
                mixed={mixedKeys.has("borderColor")}
                onChange={(value) => handleChange({ borderColor: value })}
                onCommit={commit}
                onDiscard={discard}
                onDragStart={begin}
              />
            </Panel.ResetAffordance>
          </>
        )}
      </Panel.Section>
    </Panel>
  );
}

"use client";

/**
 * Built-in panel DEFINITION for the `Border Radius` section — the wire-tree
 * replica of {@link ../sections/border-radius-section.BorderRadiusSection}.
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` + header "Border Radius" → `Panel.Section title="Border Radius"`.
 * - A single `PanelSubSection` whose content is a `flex-row` of the radius
 *   input(s) + the expand/collapse button → `Panel.Subsection` > `Panel.Row`.
 * - UNIFORM mode: one number `TextInput` (`scan` icon), wrapped in an
 *   `OverrideResetAffordance` over all four corner keys →
 *   `Panel.ResetAffordance` > `Panel.TextField kind="number" icon="scan"`.
 * - EXPANDED mode: a 2×2 grid of four number `TextInput`s with per-corner rotated
 *   `squareRoundCorner` icons, each wrapped in its own corner reset affordance →
 *   two `Panel.Row`s inside a `Panel.Column`.
 * - The expand/collapse `Button` (`fullscreen` / `vault` icon) →
 *   `Panel.Button icon="fullscreen"|"vault"` sitting as the row's last flex item.
 *
 * State + gesture discipline (identical to the old section):
 * - `showIndividualBorderRadius` is a one-time-seeded local `useState`: `true`
 *   when any of the four corner keys is mixed across a multi-selection OR the
 *   node already has non-uniform corners ({@link shouldShowIndividualBorderRadius}).
 *   Definitions mount keyed by `sectionId` (survive selection changes), so the
 *   initializer runs once per mount — verbatim parity with `key={section.id}`.
 * - Numeric typing/scrub is a DRAFT gesture (begin-on-first-change → live write →
 *   `onCommit` → commit); collapse-to-uniform is a DIRECT write of all four
 *   corners (one undo entry).
 * - Five reset affordances: the uniform one (all four keys, uniform mode) plus one
 *   per corner (expanded mode), each shown when the override reset context is
 *   active and the key(s) are overridden, resetting via `buildResetPatch`.
 */
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import { useCallback, useState } from "react";

import { useDesignerDraft } from "../../../hooks/use-designer-draft";
import { updateBorderRadiusStyle } from "../../../state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "../../../state/designer-store";
import { useStyleOverrideResetContext } from "../utils/use-style-override-reset-context";
import { useDefinitionNodes } from "./use-definition-nodes";

interface BorderRadiusStyle {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
}

/**
 * Whether the four corners diverge (any pair differs) — the seed for the
 * expanded/individual view. Replicated verbatim from the legacy section (a
 * module-local helper there, kept private to preserve the flag-off byte-identity).
 */
function shouldShowIndividualBorderRadius(node: BorderRadiusStyle): boolean {
  return (
    node.borderTopLeftRadius !== node.borderTopRightRadius ||
    node.borderTopLeftRadius !== node.borderBottomRightRadius ||
    node.borderTopLeftRadius !== node.borderBottomLeftRadius ||
    node.borderTopRightRadius !== node.borderBottomRightRadius ||
    node.borderTopRightRadius !== node.borderBottomLeftRadius ||
    node.borderBottomRightRadius !== node.borderBottomLeftRadius
  );
}

const ALL_KEYS = [
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
] as const;
const TOP_LEFT_KEYS = ["borderTopLeftRadius"] as const;
const TOP_RIGHT_KEYS = ["borderTopRightRadius"] as const;
const BOTTOM_LEFT_KEYS = ["borderBottomLeftRadius"] as const;
const BOTTOM_RIGHT_KEYS = ["borderBottomRightRadius"] as const;

/** The `Border Radius` panel definition. */
export function BorderRadiusPanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { nodes, style, targets, mixedKeys } = useDefinitionNodes();
  const overrideReset = useStyleOverrideResetContext(nodes);
  const { draft, begin, commit } = useDesignerDraft(store);

  const node = style as BorderRadiusStyle | null;

  // One-time seed: expanded when any corner key is mixed across a multi-selection
  // or the node already has non-uniform corners. Runs once per mount (definitions
  // are keyed by sectionId and survive selection changes), matching the old
  // `useState(initializer)` under `key={section.id}`.
  const [showIndividual, setShowIndividual] = useState<boolean>(() => {
    if (!node) return false;
    if (
      mixedKeys.has("borderTopLeftRadius") ||
      mixedKeys.has("borderTopRightRadius") ||
      mixedKeys.has("borderBottomRightRadius") ||
      mixedKeys.has("borderBottomLeftRadius")
    ) {
      return true;
    }
    return shouldShowIndividualBorderRadius(node);
  });

  const handleChange = useCallback(
    (incoming: Partial<BorderRadiusStyle>) => {
      dispatch(updateBorderRadiusStyle)({ nodes: targets, style: incoming });
    },
    [dispatch, targets],
  );

  const handleDraftChange = useCallback(
    (incoming: Partial<BorderRadiusStyle>) => {
      if (!draft) begin();
      dispatch(updateBorderRadiusStyle)({ nodes: targets, style: incoming });
    },
    [draft, begin, dispatch, targets],
  );

  const handleCommit = useCallback(() => {
    commit();
  }, [commit]);

  const collapse = useCallback(() => {
    if (!node) return;
    setShowIndividual(false);
    const uniform = node.borderTopLeftRadius;
    // Collapse-to-uniform is a DIRECT write of all four corners (one undo entry).
    handleChange({
      borderTopLeftRadius: uniform,
      borderTopRightRadius: uniform,
      borderBottomRightRadius: uniform,
      borderBottomLeftRadius: uniform,
    });
  }, [node, handleChange]);

  if (!node) return null;

  const active = overrideReset.isOverrideModeActive;
  const anyCornerMixed =
    mixedKeys.has("borderTopLeftRadius") ||
    mixedKeys.has("borderTopRightRadius") ||
    mixedKeys.has("borderBottomRightRadius") ||
    mixedKeys.has("borderBottomLeftRadius");

  return (
    <Panel>
      <Panel.Section title="Border Radius">
        <Panel.Subsection>
          <Panel.Row align="stretch">
            {!showIndividual && (
              <Panel.ResetAffordance
                label="border radius"
                show={active && overrideReset.hasOverride(ALL_KEYS)}
                onReset={() =>
                  handleChange(
                    overrideReset.buildResetPatch(ALL_KEYS) as Partial<BorderRadiusStyle>,
                  )
                }
              >
                <Panel.TextField
                  kind="number"
                  icon="scan"
                  min={0}
                  max={100}
                  step={1}
                  placeholder="Radius"
                  mixed={anyCornerMixed}
                  value={node.borderTopLeftRadius.toString()}
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
                />
              </Panel.ResetAffordance>
            )}

            {showIndividual && (
              <Panel.Column>
                <Panel.Row align="stretch">
                  <Panel.ResetAffordance
                    label="top left border radius"
                    show={active && overrideReset.hasOverride(TOP_LEFT_KEYS)}
                    onReset={() =>
                      handleChange(
                        overrideReset.buildResetPatch(TOP_LEFT_KEYS) as Partial<BorderRadiusStyle>,
                      )
                    }
                  >
                    <Panel.TextField
                      kind="number"
                      icon="squareRoundCornerTopLeft"
                      min={0}
                      max={100}
                      step={1}
                      placeholder="Top Left"
                      mixed={mixedKeys.has("borderTopLeftRadius")}
                      value={node.borderTopLeftRadius.toString()}
                      onChange={(value) =>
                        handleDraftChange({ borderTopLeftRadius: Number(value) })
                      }
                      onCommit={handleCommit}
                    />
                  </Panel.ResetAffordance>
                  <Panel.ResetAffordance
                    label="top right border radius"
                    show={active && overrideReset.hasOverride(TOP_RIGHT_KEYS)}
                    onReset={() =>
                      handleChange(
                        overrideReset.buildResetPatch(TOP_RIGHT_KEYS) as Partial<BorderRadiusStyle>,
                      )
                    }
                  >
                    <Panel.TextField
                      kind="number"
                      icon="squareRoundCorner"
                      min={0}
                      max={100}
                      step={1}
                      placeholder="Top Right"
                      mixed={mixedKeys.has("borderTopRightRadius")}
                      value={node.borderTopRightRadius.toString()}
                      onChange={(value) =>
                        handleDraftChange({ borderTopRightRadius: Number(value) })
                      }
                      onCommit={handleCommit}
                    />
                  </Panel.ResetAffordance>
                </Panel.Row>
                <Panel.Row align="stretch">
                  <Panel.ResetAffordance
                    label="bottom left border radius"
                    show={active && overrideReset.hasOverride(BOTTOM_LEFT_KEYS)}
                    onReset={() =>
                      handleChange(
                        overrideReset.buildResetPatch(
                          BOTTOM_LEFT_KEYS,
                        ) as Partial<BorderRadiusStyle>,
                      )
                    }
                  >
                    <Panel.TextField
                      kind="number"
                      icon="squareRoundCornerBottomLeft"
                      min={0}
                      max={100}
                      step={1}
                      placeholder="Bottom Left"
                      mixed={mixedKeys.has("borderBottomLeftRadius")}
                      value={node.borderBottomLeftRadius.toString()}
                      onChange={(value) =>
                        handleDraftChange({ borderBottomLeftRadius: Number(value) })
                      }
                      onCommit={handleCommit}
                    />
                  </Panel.ResetAffordance>
                  <Panel.ResetAffordance
                    label="bottom right border radius"
                    show={active && overrideReset.hasOverride(BOTTOM_RIGHT_KEYS)}
                    onReset={() =>
                      handleChange(
                        overrideReset.buildResetPatch(
                          BOTTOM_RIGHT_KEYS,
                        ) as Partial<BorderRadiusStyle>,
                      )
                    }
                  >
                    <Panel.TextField
                      kind="number"
                      icon="squareRoundCornerBottomRight"
                      min={0}
                      max={100}
                      step={1}
                      placeholder="Bottom Right"
                      mixed={mixedKeys.has("borderBottomRightRadius")}
                      value={node.borderBottomRightRadius.toString()}
                      onChange={(value) =>
                        handleDraftChange({ borderBottomRightRadius: Number(value) })
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
          </Panel.Row>
        </Panel.Subsection>
      </Panel.Section>
    </Panel>
  );
}

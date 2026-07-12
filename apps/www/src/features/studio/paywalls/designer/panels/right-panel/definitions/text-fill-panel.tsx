"use client";

/**
 * Built-in panel DEFINITION for the text `Fill` section — the wire-tree replica
 * of {@link ../sections/text-fill-section.TextFillSection}.
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` + header "Fill" → `Panel.Section title="Fill"`.
 * - `OverrideResetAffordance` (label "text color", shown when the `color`
 *   override is active) wrapping a `ColorInput` → `Panel.ResetAffordance` >
 *   `Panel.ColorField`.
 *
 * Behavior (identical to the old section): the reset affordance `show` is
 * `isOverrideModeActive && hasOverride(["color"])`, and `onReset` writes the
 * base value back via `updateTextFillStyle` using `buildResetPatch(["color"])`.
 * The color is a DRAFT gesture (begin/commit/discard); `mixed` reflects
 * `mixedKeys.has("color")` across a multi-selection. Text nodes are
 * state-capable, so `targets` carries them and writes persist.
 */
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import { useCallback } from "react";

import { useDesignerDraft } from "../../../hooks/use-designer-draft";
import { updateTextFillStyle } from "../../../state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "../../../state/designer-store";
import { useStyleOverrideResetContext } from "../utils/use-style-override-reset-context";
import { useDefinitionNodes } from "./use-definition-nodes";

const COLOR_KEYS = ["color"] as const;

/** The text `Fill` panel definition. */
export function TextFillPanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { nodes, style, targets, mixedKeys } = useDefinitionNodes();
  const overrideReset = useStyleOverrideResetContext(nodes);
  const { begin, commit, discard } = useDesignerDraft(store);

  const fill = style as { color: string } | null;
  const showColorReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(COLOR_KEYS);

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
    <Panel>
      <Panel.Section title="Fill">
        <Panel.ResetAffordance
          label="text color"
          show={showColorReset}
          onReset={() =>
            handleChange(
              overrideReset.buildResetPatch(COLOR_KEYS) as Partial<{ color: string }>,
            )
          }
        >
          <Panel.ColorField
            value={fill.color}
            mixed={mixedKeys.has("color")}
            onChange={handleColorChange}
            onCommit={commit}
            onDiscard={discard}
            onDragStart={begin}
          />
        </Panel.ResetAffordance>
      </Panel.Section>
    </Panel>
  );
}

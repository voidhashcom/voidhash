"use client";

/**
 * Built-in panel DEFINITION for the path `Fill` section — the wire-tree
 * replica of {@link ../sections/path-fill-section.PathFillSection}.
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` + header "Fill" → `Panel.Section title="Fill"`.
 * - header `+` enable button (only when disabled) → `Panel.SectionActions` >
 *   `Panel.Button icon="plus"` (hoisted into the header by the renderer).
 * - fillRule `ToggleGroup` (Nonzero/Even-odd) + `−` disable button, in a
 *   justify-between row → `Panel.Row justify="between"` > `Panel.ToggleGroup` +
 *   `Panel.Button icon="minus"`.
 * - fillColor `ColorInput` → `Panel.ColorField` with the same begin/commit/
 *   discard draft gesture wiring.
 *
 * Gesture discipline (identical to the old section): the color is a DRAFT
 * gesture — `onDragStart` begins a draft, `onChange` writes into it live via
 * `updatePathFillStyle`, `onCommit` commits, `onDiscard` discards. The fillRule
 * toggle and the enable/disable buttons are DIRECT writes (no draft, one undo
 * entry each). Multi-select writes target all `targets`.
 */
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import { useCallback } from "react";

import { useDesignerDraft } from "../../../hooks/use-designer-draft";
import { updatePathFillStyle } from "../../../state/actions/features/path-fill-style-actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "../../../state/designer-store";
import { useDefinitionNodes } from "./use-definition-nodes";

interface PathFillStyle {
  fillColor: string;
  fillEnabled: boolean;
  fillRule: "nonzero" | "evenodd";
  fillOpacity: number;
}

/** The path `Fill` panel definition. */
export function PathFillPanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { style, targets } = useDefinitionNodes();
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
    <Panel>
      <Panel.Section title="Fill">
        {!fill.fillEnabled && (
          <Panel.SectionActions>
            <Panel.Button
              icon="plus"
              size="icon-sm"
              onClick={() => handleChange({ fillEnabled: true })}
            />
          </Panel.SectionActions>
        )}
        {fill.fillEnabled && (
          <>
            <Panel.Row align="stretch" justify="between">
              <Panel.ToggleGroup
                value={fill.fillRule}
                options={[
                  { value: "nonzero", label: "Nonzero" },
                  { value: "evenodd", label: "Even-odd" },
                ]}
                onChange={(value) => {
                  if (value === "nonzero" || value === "evenodd") {
                    handleChange({ fillRule: value });
                  }
                }}
              />
              <Panel.Button
                icon="minus"
                size="icon-sm"
                onClick={() => handleChange({ fillEnabled: false })}
              />
            </Panel.Row>
            <Panel.ColorField
              value={fill.fillColor}
              onChange={handleColorChange}
              onCommit={commit}
              onDiscard={discard}
              onDragStart={begin}
            />
          </>
        )}
      </Panel.Section>
    </Panel>
  );
}

"use client";

/**
 * Built-in panel DEFINITION for the path `Stroke` section — the wire-tree
 * replica of {@link ../sections/path-stroke-section.PathStrokeSection}.
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` + header "Stroke" → `Panel.Section title="Stroke"`.
 * - header `+` enable button (only when disabled) → `Panel.SectionActions` >
 *   `Panel.Button icon="plus"`.
 * - "Width" `PanelSubSection`: `TextInput` (SquareIcon, min 0, number) + `−`
 *   disable button in a row → `Panel.Subsection title="Width"` > `Panel.Row` >
 *   `Panel.TextField kind="number" icon="square"` + `Panel.Button icon="minus"`.
 * - "Line Cap" `ToggleGroup` (Butt/Round/Square) → `Panel.Subsection` >
 *   `Panel.ToggleGroup`.
 * - "Line Join" `ToggleGroup` (Miter/Round/Bevel) → `Panel.Subsection` >
 *   `Panel.ToggleGroup`.
 * - strokeColor `ColorInput` → `Panel.ColorField`.
 *
 * Gesture discipline (identical to the old section): the Width text input is a
 * DRAFT gesture (typing/scrub via `handleDraftChange` → begin-on-first-change +
 * live write, `onCommit` → commit); the color is a DRAFT gesture
 * (begin/commit/discard); the two line toggles and the enable/disable buttons
 * are DIRECT writes.
 */
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import { useCallback } from "react";

import { useDesignerDraft } from "../../../hooks/use-designer-draft";
import { updatePathStrokeStyle } from "../../../state/actions/features/path-stroke-style-actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "../../../state/designer-store";
import { useDefinitionNodes } from "./use-definition-nodes";

interface PathStrokeStyle {
  strokeColor: string;
  strokeEnabled: boolean;
  strokeWidth: number;
  strokeLinecap: "butt" | "round" | "square";
  strokeLinejoin: "miter" | "round" | "bevel";
  strokeOpacity: number;
}

/** The path `Stroke` panel definition. */
export function PathStrokePanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { style, targets } = useDefinitionNodes();
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
    <Panel>
      <Panel.Section title="Stroke">
        {!stroke.strokeEnabled && (
          <Panel.SectionActions>
            <Panel.Button
              icon="plus"
              size="icon-sm"
              onClick={() => handleChange({ strokeEnabled: true })}
            />
          </Panel.SectionActions>
        )}
        {stroke.strokeEnabled && (
          <>
            <Panel.Subsection title="Width">
              <Panel.Row align="stretch">
                <Panel.TextField
                  kind="number"
                  icon="square"
                  min={0}
                  step={1}
                  placeholder="Stroke Width"
                  value={stroke.strokeWidth.toString()}
                  onChange={(value) => {
                    handleDraftChange({ strokeWidth: Number(value) });
                  }}
                  onCommit={handleCommit}
                />
                <Panel.Button
                  icon="minus"
                  size="icon-sm"
                  onClick={() => handleChange({ strokeEnabled: false })}
                />
              </Panel.Row>
            </Panel.Subsection>
            <Panel.Subsection title="Line Cap">
              <Panel.ToggleGroup
                value={stroke.strokeLinecap}
                options={[
                  { value: "butt", label: "Butt" },
                  { value: "round", label: "Round" },
                  { value: "square", label: "Square" },
                ]}
                onChange={(value) => {
                  if (value === "butt" || value === "round" || value === "square") {
                    handleChange({ strokeLinecap: value });
                  }
                }}
              />
            </Panel.Subsection>
            <Panel.Subsection title="Line Join">
              <Panel.ToggleGroup
                value={stroke.strokeLinejoin}
                options={[
                  { value: "miter", label: "Miter" },
                  { value: "round", label: "Round" },
                  { value: "bevel", label: "Bevel" },
                ]}
                onChange={(value) => {
                  if (value === "miter" || value === "round" || value === "bevel") {
                    handleChange({ strokeLinejoin: value });
                  }
                }}
              />
            </Panel.Subsection>
            <Panel.ColorField
              value={stroke.strokeColor}
              onChange={(value) => handleChange({ strokeColor: value })}
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

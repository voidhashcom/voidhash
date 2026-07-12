"use client";

/**
 * Built-in panel DEFINITION for the `Fill` section — the wire-tree replica of
 * {@link ../sections/fill-section.FillSection}.
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` + header "Fill" → `Panel.Section title="Fill"`.
 * - When the fill is disabled (and not mixed) the header hosts a `+` enable
 *   `Button`, wrapped in the "fill enabled" `OverrideResetAffordance` (the
 *   `[backgroundEnabled, backgroundColor]` reset payload) → `Panel.SectionActions`
 *   > `Panel.ResetAffordance` > `Panel.Button icon="plus"`.
 * - When enabled (or mixed) the body renders the swatch+row wrapped in the SAME
 *   "fill" reset affordance, containing the `Panel.FillField` composite and the
 *   `−` disable `Button`.
 *
 * CRDT gradient envelope (verbatim from the old section):
 * - `data.style.backgroundGradient` is read in its DECODED shape — its `stops`
 *   are `{ value }`-wrapped by the mimic CRDT decoder. {@link toWriteGradient}
 *   unwraps them into the logical `{ color, position }[]` write shape (falling
 *   back to a deep-cloned {@link DEFAULT_GRADIENT} when absent), and EVERY
 *   gradient mutation writes the WHOLE rebuilt gradient back through
 *   `updateFillStyle` — never a partial stop patch — so the CRDT never sees an
 *   in-place nested-struct mutation it can't introduce.
 *
 * Wire-event partition (the ONE deliberate divergence from the old section):
 * - The `fillField` composite has 15 event callbacks but `PANEL_CAPS.
 *   eventsPerNode` is 8, so the node carries only the WRITE-bearing events:
 *   `onTypeChange`, `onColorChange`, `onGradientChange`, `onImageUrlChange`,
 *   `onImageResizeModeChange`, `onGestureStart`, `onCommit`, `onDiscard`. The two
 *   pure-UI concerns the old section held in local state — the editor popover's
 *   `open` and the selected gradient stop `selectedStopIndex` (+ its clamping
 *   effect) — plus the granular stop callbacks (`onStopColorChange`,
 *   `onStopPositionChange`, `onAddStop`, `onAddStopAt`, `onRemoveStop`) are
 *   handled HOST-LOCAL in the renderer's fillField view: each stop mutation
 *   rebuilds the whole stops array and dispatches ONE `onGradientChange`. The
 *   store-facing behavior (which whole gradients get written, and when) is
 *   therefore identical; only the transport of pure-UI state differs.
 *
 * Gesture + write discipline (identical to the old section):
 * - `onGestureStart` opens the draft (begin), live `onColorChange` /
 *   `onGradientChange` dispatch `updateFillStyle` into it, `onCommit` commits it
 *   (one undo entry per gesture), `onDiscard` discards it. Type changes, enable,
 *   disable, and image url/resize are DIRECT writes (one undo each). No-op writes
 *   are suppressed by `applyStyleUpdate`'s per-key `styleValuesEqual` guard.
 */
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import type { PanelJsonValue } from "@voidhash/paywalls/schema";
import { useCallback } from "react";

import { useDesignerDraft } from "../../../hooks/use-designer-draft";
import { rgbaToHexOpacity } from "../../../panel-kit/color-picker/color-utils";
import { updateFillStyle } from "../../../state/actions";
import type {
  BackgroundGradient,
  BackgroundImage,
  BackgroundType,
  GradientStop,
} from "../../../state/actions/features/fill-style-actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "../../../state/designer-store";
import { useStyleOverrideResetContext } from "../utils/use-style-override-reset-context";
import { useDefinitionNodes } from "./use-definition-nodes";

/**
 * The decoded (read) shape of a gradient on `data.style`. Array elements are
 * wrapped by the mimic CRDT decoder as `{ value }`; scalar fields are plain.
 */
interface DecodedGradient {
  kind: "linear" | "radial";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  stops: Array<{ value?: GradientStop }>;
}

/**
 * The panel-facing view of a node's effective fill style. Structured fields are
 * read in their decoded (CRDT-wrapped) form; the panel unwraps them before use.
 */
interface FillStyleRead {
  backgroundColor: string;
  backgroundEnabled: boolean;
  backgroundType?: BackgroundType;
  backgroundGradient?: DecodedGradient;
  backgroundImage?: BackgroundImage;
}

interface FillStyleWrite {
  backgroundColor: string;
  backgroundEnabled: boolean;
  backgroundType: BackgroundType;
  backgroundGradient: BackgroundGradient;
  backgroundImage: BackgroundImage;
}

const DEFAULT_GRADIENT: BackgroundGradient = {
  kind: "linear",
  startX: 0.5,
  startY: 0,
  endX: 0.5,
  endY: 1,
  stops: [
    { color: "rgba(255, 255, 255, 1)", position: 0 },
    { color: "rgba(255, 255, 255, 0)", position: 1 },
  ],
};

/** Unwrap the CRDT-decoded gradient into the logical write shape. */
function toWriteGradient(decoded: DecodedGradient | undefined): BackgroundGradient {
  if (!decoded) {
    return { ...DEFAULT_GRADIENT, stops: DEFAULT_GRADIENT.stops.map((s) => ({ ...s })) };
  }
  const stops = decoded.stops
    .map((entry) => entry.value)
    .filter((stop): stop is GradientStop => stop !== undefined)
    .map((stop) => ({ color: stop.color, position: stop.position }));
  return {
    kind: decoded.kind,
    startX: decoded.startX,
    startY: decoded.startY,
    endX: decoded.endX,
    endY: decoded.endY,
    stops,
  };
}

const ENABLED_KEYS = ["backgroundEnabled"] as const;
const COLOR_KEYS = ["backgroundColor"] as const;
// The set the "fill" reset restores (its onReset payload), matching the old
// section's `fillRelatedKeys`.
const RELATED_KEYS = ["backgroundEnabled", "backgroundColor"] as const;

/** The `Fill` panel definition. */
export function FillPanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { nodes, style, targets, mixedKeys } = useDefinitionNodes();
  const overrideReset = useStyleOverrideResetContext(nodes);
  const { begin, commit, discard } = useDesignerDraft(store);

  const fill = style as unknown as FillStyleRead | null;

  const isBackgroundEnabledMixed = mixedKeys.has("backgroundEnabled");
  const isBackgroundTypeMixed = mixedKeys.has("backgroundType");

  const handleChange = useCallback(
    (incoming: Partial<FillStyleWrite>) => {
      dispatch(updateFillStyle)({ nodes: targets, style: incoming });
    },
    [dispatch, targets],
  );

  const handleColorChange = useCallback(
    (value: string) => {
      dispatch(updateFillStyle)({ nodes: targets, style: { backgroundColor: value } });
    },
    [dispatch, targets],
  );

  const writeGradient = useCallback(
    (next: BackgroundGradient) => {
      handleChange({ backgroundGradient: next });
    },
    [handleChange],
  );

  if (!fill) return null;

  const backgroundType: BackgroundType = fill.backgroundType ?? "solid";
  const gradient = toWriteGradient(fill.backgroundGradient);
  const image: BackgroundImage = fill.backgroundImage ?? { url: "", resizeMode: "cover" };

  const handleImageUrl = (url: string) => {
    handleChange({ backgroundImage: { ...image, url } });
  };
  const handleImageResizeMode = (resizeMode: BackgroundImage["resizeMode"]) => {
    handleChange({ backgroundImage: { ...image, resizeMode } });
  };

  const active = overrideReset.isOverrideModeActive;
  const showEnabledReset = active && overrideReset.hasOverride(ENABLED_KEYS);
  const showColorReset =
    !showEnabledReset && active && overrideReset.hasOverride(COLOR_KEYS);

  const resetFill = () =>
    handleChange(overrideReset.buildResetPatch(RELATED_KEYS) as Partial<FillStyleWrite>);

  const rowLabel = isBackgroundTypeMixed
    ? "Mixed"
    : backgroundType === "solid"
      ? `#${rgbaToHexOpacity(fill.backgroundColor).hex}`
      : backgroundType === "gradient"
        ? gradient.kind === "linear"
          ? "Linear"
          : "Radial"
        : "Image";

  return (
    <Panel>
      <Panel.Section title="Fill">
        {!fill.backgroundEnabled && !isBackgroundEnabledMixed && (
          <Panel.SectionActions>
            <Panel.ResetAffordance label="fill enabled" show={showEnabledReset} onReset={resetFill}>
              <Panel.Button
                icon="plus"
                size="icon-sm"
                onClick={() => handleChange({ backgroundEnabled: true })}
              />
            </Panel.ResetAffordance>
          </Panel.SectionActions>
        )}
        {(fill.backgroundEnabled || isBackgroundEnabledMixed) && (
          <Panel.ResetAffordance
            label="fill"
            show={showEnabledReset || showColorReset}
            onReset={resetFill}
          >
            <Panel.Row align="center">
              <Panel.FillField
                label={rowLabel}
                backgroundType={backgroundType}
                isTypeMixed={isBackgroundTypeMixed}
                backgroundColor={fill.backgroundColor}
                gradient={gradient as unknown as PanelJsonValue}
                image={image as unknown as PanelJsonValue}
                onTypeChange={(type) => handleChange({ backgroundType: type as BackgroundType })}
                onColorChange={handleColorChange}
                onGradientChange={(next) => writeGradient(next as unknown as BackgroundGradient)}
                onImageUrlChange={handleImageUrl}
                onImageResizeModeChange={(mode) =>
                  handleImageResizeMode(mode as BackgroundImage["resizeMode"])
                }
                onGestureStart={begin}
                onCommit={commit}
                onDiscard={discard}
              />
              <Panel.Button
                icon="minus"
                size="icon-sm"
                onClick={() => handleChange({ backgroundEnabled: false })}
              />
            </Panel.Row>
          </Panel.ResetAffordance>
        )}
      </Panel.Section>
    </Panel>
  );
}

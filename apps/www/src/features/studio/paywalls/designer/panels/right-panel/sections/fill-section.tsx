"use client";

import { resolveBackgroundImage } from "@voidhash/mimic-schema";
import type {
  ScreenSnapshotNode,
  ScrollViewSnapshotNode,
  SnapshotNode,
  ViewSnapshotNode,
} from "@voidhash/paywall-renderer-web-core";
import { useDesignerDraft } from "@/features/studio/paywalls/designer/hooks/use-designer-draft";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand/react";

import { Badge, Button } from "@voidhash/ui";
import { rgbaToHexOpacity } from "@/features/studio/paywalls/designer/panel-kit/color-picker/color-utils";
import { FillField } from "@/features/studio/paywalls/designer/panel-kit/fill-field";
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionHeaderActions,
  PanelSectionTitle,
} from "@/features/studio/paywalls/designer/panel-kit/panel-section";
import { OverrideResetAffordance } from "@/features/studio/paywalls/designer/panel-kit/reset-affordance";
import type {
  BackgroundGradient,
  BackgroundImage,
  BackgroundType,
  GradientStop,
} from "@/features/studio/paywalls/designer/state/actions/features/fill-style-actions";
import {
  updateFillStyle,
  updateNodeLocalizedImage,
} from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";
import { selectDefaultLocale } from "@/features/studio/paywalls/designer/state/utils/localization";

import { nextStopPosition } from "../utils/gradient-stops";
import { useStyleTargets } from "../utils/get-style-targets";
import { useStyleOverrideResetContext } from "../utils/use-style-override-reset-context";

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

export function FillSection({ nodes }: { nodes: SnapshotNode[] }) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { style, targets, mixedKeys } = useStyleTargets(nodes);
  const overrideReset = useStyleOverrideResetContext(nodes);
  const { begin, commit, discard } = useDesignerDraft(store);
  const activeLocale = useStore(store, (state) => state.activeLocale);
  const defaultLocale = useStore(store, selectDefaultLocale);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedStopIndex, setSelectedStopIndex] = useState<number | null>(0);

  const fill = style as unknown as FillStyleRead | null;

  const isBackgroundEnabledMixed = mixedKeys.has("backgroundEnabled");
  const isBackgroundTypeMixed = mixedKeys.has("backgroundType");
  const backgroundEnabledKeys = ["backgroundEnabled"] as const;
  const backgroundColorKeys = ["backgroundColor"] as const;
  const fillRelatedKeys = ["backgroundEnabled", "backgroundColor"] as const;

  const showBackgroundEnabledReset =
    overrideReset.isOverrideModeActive && overrideReset.hasOverride(backgroundEnabledKeys);
  const showBackgroundColorReset =
    !showBackgroundEnabledReset &&
    overrideReset.isOverrideModeActive &&
    overrideReset.hasOverride(backgroundColorKeys);

  const handleChange = useCallback(
    (incoming: Partial<FillStyleWrite>) => {
      dispatch(updateFillStyle)({ nodes: targets, style: incoming });
    },
    [dispatch, targets],
  );

  const handleColorChange = useCallback(
    (value: string) => {
      dispatch(updateFillStyle)({
        nodes: targets,
        style: { backgroundColor: value },
      });
    },
    [dispatch, targets],
  );

  const backgroundType: BackgroundType = fill?.backgroundType ?? "solid";
  const gradient = toWriteGradient(fill?.backgroundGradient);

  // Keep the selected stop index within bounds as stops are added/removed.
  useEffect(() => {
    setSelectedStopIndex((prev) => {
      if (gradient.stops.length === 0) return null;
      if (prev === null) return 0;
      return Math.min(prev, gradient.stops.length - 1);
    });
  }, [gradient.stops.length]);

  const writeGradient = useCallback(
    (next: BackgroundGradient) => {
      handleChange({ backgroundGradient: next });
    },
    [handleChange],
  );

  const handleStopColor = useCallback(
    (index: number, color: string) => {
      const stops = gradient.stops.map((stop, i) => (i === index ? { ...stop, color } : stop));
      writeGradient({ ...gradient, stops });
    },
    [gradient, writeGradient],
  );

  const handleStopPosition = useCallback(
    (index: number, position: number) => {
      const clamped = Math.min(1, Math.max(0, position));
      const stops = gradient.stops.map((stop, i) =>
        i === index ? { ...stop, position: clamped } : stop,
      );
      writeGradient({ ...gradient, stops });
    },
    [gradient, writeGradient],
  );

  const handleAddStop = useCallback(() => {
    const position = nextStopPosition(gradient.stops);
    const lastColor = gradient.stops.at(-1)?.color ?? "rgba(255, 255, 255, 1)";
    const stops = [...gradient.stops, { color: lastColor, position }].sort(
      (a, b) => a.position - b.position,
    );
    writeGradient({ ...gradient, stops });
    setSelectedStopIndex(stops.findIndex((s) => s.position === position && s.color === lastColor));
  }, [gradient, writeGradient]);

  const handleAddStopAt = useCallback(
    (position: number, color: string) => {
      const clamped = Math.min(1, Math.max(0, position));
      const stops = [...gradient.stops, { color, position: clamped }].sort(
        (a, b) => a.position - b.position,
      );
      writeGradient({ ...gradient, stops });
      setSelectedStopIndex(
        stops.findIndex((s) => s.position === clamped && s.color === color),
      );
    },
    [gradient, writeGradient],
  );

  const handleRemoveStop = useCallback(
    (index: number) => {
      if (gradient.stops.length <= 2) return;
      const stops = gradient.stops.filter((_, i) => i !== index);
      writeGradient({ ...gradient, stops });
    },
    [gradient, writeGradient],
  );

  const image: BackgroundImage = fill?.backgroundImage ?? { url: "", resizeMode: "cover" };

  // Per-locale image editing: only for a single view/scrollView/screen node whose
  // base fill is an image, in a non-default locale, and NOT while a state-override
  // editing session is active — the state-override editing surface takes priority
  // over the locale surface (keep precedence simple).
  const singleNode = nodes.length === 1 ? nodes[0] : undefined;
  const localeNode =
    singleNode !== undefined &&
    (singleNode.type === "view" ||
      singleNode.type === "scrollView" ||
      singleNode.type === "screen")
      ? (singleNode as ViewSnapshotNode | ScrollViewSnapshotNode | ScreenSnapshotNode)
      : undefined;
  const isLocaleImageEditing =
    !overrideReset.isOverrideModeActive &&
    activeLocale !== null &&
    activeLocale !== defaultLocale &&
    backgroundType === "image" &&
    localeNode !== undefined;
  const resolvedLocaleImage =
    isLocaleImageEditing && localeNode !== undefined && activeLocale !== null
      ? resolveBackgroundImage(localeNode.data, activeLocale, defaultLocale)
      : undefined;
  const hasLocalizedImageOverride =
    resolvedLocaleImage !== undefined &&
    localeNode !== undefined &&
    resolvedLocaleImage !== localeNode.data.style.backgroundImage;
  const displayImage: BackgroundImage =
    resolvedLocaleImage !== undefined
      ? { url: resolvedLocaleImage.url, resizeMode: resolvedLocaleImage.resizeMode }
      : image;

  const handleImageUrl = useCallback(
    (url: string) => {
      if (isLocaleImageEditing && localeNode !== undefined && activeLocale !== null) {
        dispatch(updateNodeLocalizedImage)({
          id: localeNode.id,
          locale: activeLocale,
          backgroundImage: { ...displayImage, url },
        });
        return;
      }
      handleChange({ backgroundImage: { ...image, url } });
    },
    [isLocaleImageEditing, localeNode, activeLocale, displayImage, dispatch, handleChange, image],
  );

  const handleImageResizeMode = useCallback(
    (resizeMode: BackgroundImage["resizeMode"]) => {
      if (isLocaleImageEditing && localeNode !== undefined && activeLocale !== null) {
        dispatch(updateNodeLocalizedImage)({
          id: localeNode.id,
          locale: activeLocale,
          backgroundImage: { ...displayImage, resizeMode },
        });
        return;
      }
      handleChange({ backgroundImage: { ...image, resizeMode } });
    },
    [isLocaleImageEditing, localeNode, activeLocale, displayImage, dispatch, handleChange, image],
  );

  const handleResetLocalizedImage = useCallback(() => {
    if (localeNode !== undefined && activeLocale !== null) {
      dispatch(updateNodeLocalizedImage)({
        id: localeNode.id,
        locale: activeLocale,
        backgroundImage: null,
      });
    }
  }, [dispatch, localeNode, activeLocale]);

  if (!fill) return null;

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
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Fill</PanelSectionTitle>
        {isLocaleImageEditing && activeLocale !== null && (
          <Badge className="px-1 py-0 text-[10px]" variant="secondary">
            {activeLocale}
          </Badge>
        )}
        <PanelSectionHeaderActions>
          {!fill.backgroundEnabled && !isBackgroundEnabledMixed && (
            <OverrideResetAffordance
              label="fill enabled"
              onReset={() =>
                handleChange(overrideReset.buildResetPatch(fillRelatedKeys) as Partial<FillStyleWrite>)
              }
              show={showBackgroundEnabledReset}
            >
              <Button
                onClick={() => handleChange({ backgroundEnabled: true })}
                size="icon-sm"
                variant="secondary"
              >
                <PlusIcon />
              </Button>
            </OverrideResetAffordance>
          )}
        </PanelSectionHeaderActions>
      </PanelSectionHeader>
      {(fill.backgroundEnabled || isBackgroundEnabledMixed) && (
        <PanelSectionContent>
          <OverrideResetAffordance
            label={isLocaleImageEditing ? "localized fill" : "fill"}
            onReset={
              isLocaleImageEditing
                ? handleResetLocalizedImage
                : () =>
                    handleChange(
                      overrideReset.buildResetPatch(fillRelatedKeys) as Partial<FillStyleWrite>,
                    )
            }
            show={
              isLocaleImageEditing
                ? hasLocalizedImageOverride
                : showBackgroundEnabledReset || showBackgroundColorReset
            }
          >
            <div className="flex flex-row items-center gap-2">
              <FillField
                backgroundColor={fill.backgroundColor}
                backgroundType={backgroundType}
                gradient={gradient}
                image={displayImage}
                isTypeMixed={isBackgroundTypeMixed}
                label={rowLabel}
                onAddStop={handleAddStop}
                onAddStopAt={handleAddStopAt}
                onColorChange={handleColorChange}
                onCommit={commit}
                onDiscard={discard}
                onGestureStart={begin}
                onGradientChange={writeGradient}
                onImageResizeModeChange={handleImageResizeMode}
                onImageUrlChange={handleImageUrl}
                onOpenChange={setIsOpen}
                onRemoveStop={handleRemoveStop}
                onSelectStop={setSelectedStopIndex}
                onStopColorChange={handleStopColor}
                onStopPositionChange={handleStopPosition}
                onTypeChange={(type) => handleChange({ backgroundType: type })}
                open={isOpen}
                selectedStopIndex={selectedStopIndex}
              />
              <Button
                aria-label="Remove fill"
                onClick={() => handleChange({ backgroundEnabled: false })}
                size="icon-sm"
                variant="secondary"
              >
                <MinusIcon />
              </Button>
            </div>
          </OverrideResetAffordance>
        </PanelSectionContent>
      )}
    </PanelSection>
  );
}

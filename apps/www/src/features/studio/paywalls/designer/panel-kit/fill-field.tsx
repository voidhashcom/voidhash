"use client";

import { useParams } from "@tanstack/react-router";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@voidhash/ui";
import {
  FlipHorizontalIcon,
  ImageIcon,
  ImagePlusIcon,
  PlusIcon,
  RotateCwIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useAuth } from "@/features/studio/components/auth-context";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { AssetPickerDialog } from "@/features/studio/paywall-assets/asset-picker-dialog";
import type {
  BackgroundGradient,
  BackgroundImage,
  BackgroundType,
} from "@/features/studio/paywalls/designer/state/actions/features/fill-style-actions";

import { CheckerboardBackground } from "./color-picker/checkerboard-background";
import { ColorPickerContent } from "./color-picker/color-picker-content";
import { ColorSwatch } from "./color-picker/color-swatch";
import { hexOpacityToRgba, rgbaToHexOpacity } from "./color-picker/color-utils";
import { ColorInput } from "./color-input";
import { GradientStopBar } from "./gradient-stop-bar";
import { PopoverHeader } from "./popover-header";
import { SelectInput } from "./select-input";
import { TextInput } from "./text-input";

const GRADIENT_KIND_OPTIONS: { value: "linear" | "radial"; label: string }[] = [
  { label: "Linear", value: "linear" },
  { label: "Radial", value: "radial" },
];

const RESIZE_MODE_OPTIONS: { value: BackgroundImage["resizeMode"]; label: string }[] = [
  { label: "Cover", value: "cover" },
  { label: "Contain", value: "contain" },
  { label: "Stretch", value: "stretch" },
  { label: "Center", value: "center" },
];

/**
 * The full public surface of the fill composite. Mirrors
 * `FillEditorPopoverContentProps` 1:1 plus the fill-row bits (`label`, `open`,
 * `onOpenChange`). `onGestureStart` is the row-level rename of the popover's
 * `onDragStart` (begin-draft); its wiring is otherwise identical.
 */
export interface FillFieldProps {
  /** The compact row label shown next to the preview swatch (e.g. `#RRGGBB`, `Linear`, `Image`, `Mixed`). */
  label: string;

  backgroundType: BackgroundType;
  isTypeMixed: boolean;
  onTypeChange: (type: BackgroundType) => void;

  backgroundColor: string;
  onColorChange: (value: string) => void;

  gradient: BackgroundGradient;
  onGradientChange: (gradient: BackgroundGradient) => void;
  onStopColorChange: (index: number, color: string) => void;
  onStopPositionChange: (index: number, position: number) => void;
  onAddStop: () => void;
  onAddStopAt: (position: number, color: string) => void;
  onRemoveStop: (index: number) => void;
  selectedStopIndex: number | null;
  onSelectStop: (index: number) => void;

  image: BackgroundImage;
  onImageUrlChange: (url: string) => void;
  onImageResizeModeChange: (resizeMode: BackgroundImage["resizeMode"]) => void;

  /** Begin a deferred edit (drag start on picker/slider/stop marker). */
  onGestureStart: () => void;
  onCommit: () => void;
  onDiscard: () => void;

  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Wraps a URL in a CSS `url("…")` token, escaping `\` and `"` so arbitrary paste URLs can't break the declaration. */
function cssUrl(url: string): string {
  return `url("${url.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

/** Builds a left→right CSS `linear-gradient` preview from stops sorted by position. */
function buildPreviewGradient(gradient: BackgroundGradient): string {
  if (gradient.stops.length === 0) {
    return "transparent";
  }
  const sorted = [...gradient.stops].sort((a, b) => a.position - b.position);
  const segments = sorted.map(
    (stop) => `${stop.color} ${(Math.max(0, Math.min(1, stop.position)) * 100).toFixed(2)}%`,
  );
  return `linear-gradient(to right, ${segments.join(", ")})`;
}

/**
 * Rotates a 2D point around a pivot by 90° clockwise in the normalized fill
 * coordinate space (y-down, so a clockwise screen rotation).
 */
function rotate90(x: number, y: number, cx: number, cy: number): { x: number; y: number } {
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx - dy, y: cy + dx };
}

/**
 * The compact preview swatch shown in the fill row. Renders a solid color, a
 * gradient sample, or an image thumbnail depending on `type`.
 */
function FillPreviewSwatch({
  type,
  color,
  gradient,
  image,
}: {
  type: BackgroundType;
  color: string;
  gradient: BackgroundGradient;
  image: BackgroundImage;
}) {
  if (type === "solid") {
    const { hex, opacity } = rgbaToHexOpacity(color);
    return <ColorSwatch color={hex} opacity={opacity} />;
  }
  if (type === "gradient") {
    return (
      <div className="relative size-5 shrink-0 overflow-hidden rounded-[3px]">
        <CheckerboardBackground />
        <div className="absolute inset-0" style={{ background: buildPreviewGradient(gradient) }} />
        <div className="absolute inset-0 rounded-[3px] ring-1 ring-white/20 ring-inset" />
      </div>
    );
  }
  return (
    <div className="relative flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-muted">
      {image.url ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: cssUrl(image.url),
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />
      ) : (
        <ImageIcon className="size-3 text-muted-foreground" />
      )}
      <div className="absolute inset-0 rounded-[3px] ring-1 ring-white/20 ring-inset" />
    </div>
  );
}

/**
 * The Image fill tab body: a preview tile that doubles as the picker trigger,
 * followed by a resize-mode select (shown only once an image is set).
 *
 * The tile shows the current image over a {@link CheckerboardBackground} (so
 * transparency reads) with a small remove affordance, or a dashed empty state
 * when no image is set. Clicking the tile opens the organization asset picker;
 * selecting a library asset writes its URL through `onUrlChange`.
 *
 * The picker is a modal Dialog opened from inside the Fill Popover. It portals
 * to the document body and owns its own focus trap, so it survives the Popover
 * dismissing underneath it; the selected URL is committed regardless of the
 * Popover's open state. When the organization id cannot be resolved (missing
 * route slugs) the tile still renders, but no images are selectable — the
 * library grid needs the org context to list assets.
 */
/** Props for the reusable image-tab body (shared by fill-field + the standalone image-field). */
export interface ImageFillContentProps {
  image: BackgroundImage;
  onUrlChange: (url: string) => void;
  onResizeModeChange: (resizeMode: BackgroundImage["resizeMode"]) => void;
}

export function ImageFillContent({
  image,
  onUrlChange,
  onResizeModeChange,
}: ImageFillContentProps) {
  const { organizationSlug, projectSlug } = useParams({ strict: false });
  const { user } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);

  const organizationId = useMemo(() => {
    if (!organizationSlug || !projectSlug) return null;
    return (
      CurrentUser.getProjectBySlugs(user, organizationSlug, projectSlug)?.organizationId ?? null
    );
  }, [user, organizationSlug, projectSlug]);

  const hasImage = image.url.trim() !== "";

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <button
          aria-label={hasImage ? "Change image" : "Add image"}
          className={cn(
            "relative flex h-24 w-full items-center justify-center overflow-hidden rounded-sm text-xs outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            hasImage
              ? "border border-border/60"
              : "flex-col gap-1 border border-dashed border-input text-muted-foreground hover:text-foreground dark:bg-input/60 dark:hover:bg-input/80",
          )}
          onClick={() => setPickerOpen(true)}
          type="button"
        >
          {hasImage ? (
            <>
              <CheckerboardBackground />
              <img
                alt="Selected background"
                className="absolute inset-0 size-full object-cover"
                loading="lazy"
                src={image.url}
              />
            </>
          ) : (
            <>
              <ImagePlusIcon className="size-5" />
              <span>Add image</span>
            </>
          )}
        </button>
        {hasImage ? (
          <button
            aria-label="Remove image"
            className={cn(
              "absolute top-1 right-1 flex size-5 items-center justify-center rounded-sm text-white/90 outline-none transition-colors",
              "bg-black/45 hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-ring",
            )}
            onClick={() => onUrlChange("")}
            type="button"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>

      {hasImage ? (
        <SelectInput
          label="Resize mode"
          onChange={onResizeModeChange}
          options={RESIZE_MODE_OPTIONS}
          value={image.resizeMode}
        />
      ) : null}

      <AssetPickerDialog
        onOpenChange={setPickerOpen}
        onSelect={(asset) => onUrlChange(asset.url)}
        open={pickerOpen}
        organizationId={organizationId}
      />
    </div>
  );
}

/**
 * The body of the Fill editor popover: a type tab row followed by the tab body
 * for the active background type. All state lives in the caller; this component
 * is a controlled view over it.
 */
function FillEditorPopoverContent({
  backgroundType,
  isTypeMixed,
  onTypeChange,
  backgroundColor,
  onColorChange,
  gradient,
  onGradientChange,
  onStopColorChange,
  onStopPositionChange,
  onAddStop,
  onAddStopAt,
  onRemoveStop,
  selectedStopIndex,
  onSelectStop,
  image,
  onImageUrlChange,
  onImageResizeModeChange,
  onGestureStart,
  onCommit,
  onDiscard,
}: Omit<FillFieldProps, "label" | "open" | "onOpenChange">) {
  const { hex, opacity } = rgbaToHexOpacity(backgroundColor);

  const handleSolidHex = useCallback(
    (nextHex: string) => {
      onColorChange(hexOpacityToRgba(nextHex, opacity));
    },
    [onColorChange, opacity],
  );

  const handleSolidOpacity = useCallback(
    (nextOpacity: number) => {
      onColorChange(hexOpacityToRgba(hex, nextOpacity));
    },
    [onColorChange, hex],
  );

  const handleFlip = useCallback(() => {
    onGradientChange({
      ...gradient,
      startX: gradient.endX,
      startY: gradient.endY,
      endX: gradient.startX,
      endY: gradient.startY,
    });
  }, [gradient, onGradientChange]);

  const handleRotate = useCallback(() => {
    const cx = (gradient.startX + gradient.endX) / 2;
    const cy = (gradient.startY + gradient.endY) / 2;
    const start = rotate90(gradient.startX, gradient.startY, cx, cy);
    const end = rotate90(gradient.endX, gradient.endY, cx, cy);
    onGradientChange({
      ...gradient,
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
    });
  }, [gradient, onGradientChange]);

  return (
    <div className="flex w-[260px] flex-col gap-3">
      <ToggleGroup
        className="w-full"
        onValueChange={(value) => {
          if (value === "solid" || value === "gradient" || value === "image") {
            onTypeChange(value);
          }
        }}
        size="sm"
        type="single"
        value={isTypeMixed ? "" : backgroundType}
      >
        <ToggleGroupItem className="flex-1" size="sm" value="solid">
          Solid
        </ToggleGroupItem>
        <ToggleGroupItem className="flex-1" size="sm" value="gradient">
          Gradient
        </ToggleGroupItem>
        <ToggleGroupItem className="flex-1" size="sm" value="image">
          Image
        </ToggleGroupItem>
      </ToggleGroup>

      {isTypeMixed ? (
        <p className="text-muted-foreground text-xs">
          Selection has mixed fill types. Pick a type to apply it to all.
        </p>
      ) : backgroundType === "solid" ? (
        <ColorPickerContent
          color={hex}
          onColorChange={handleSolidHex}
          onDiscard={onDiscard}
          onDragEnd={onCommit}
          onDragStart={onGestureStart}
          onOpacityChange={handleSolidOpacity}
          opacity={opacity}
        />
      ) : backgroundType === "gradient" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-row items-center gap-2">
            <SelectInput
              className="flex-1"
              label="Gradient type"
              onChange={(kind) => onGradientChange({ ...gradient, kind })}
              options={GRADIENT_KIND_OPTIONS}
              value={gradient.kind}
            />
            <Button
              aria-label="Flip gradient direction"
              onClick={handleFlip}
              size="icon-sm"
              variant="outline"
            >
              <FlipHorizontalIcon />
            </Button>
            <Button
              aria-label="Rotate gradient 90 degrees"
              onClick={handleRotate}
              size="icon-sm"
              variant="outline"
            >
              <RotateCwIcon />
            </Button>
          </div>

          <GradientStopBar
            onAddStop={onAddStopAt}
            onDiscard={onDiscard}
            onDragEnd={onCommit}
            onDragStart={onGestureStart}
            onPositionChange={onStopPositionChange}
            onSelect={onSelectStop}
            selectedIndex={selectedStopIndex}
            stops={gradient.stops}
          />

          <div className="flex flex-col gap-2">
            <div className="flex flex-row items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">Stops</span>
              <Button aria-label="Add stop" onClick={onAddStop} size="icon-sm" variant="ghost">
                <PlusIcon />
              </Button>
            </div>
            {gradient.stops.map((stop, index) => (
              // Stops are positional; no stable id exists on the write shape, so
              // the index is the key.
              <div
                className="flex flex-row items-center gap-2"
                key={index}
                onPointerDownCapture={() => onSelectStop(index)}
              >
                <TextInput
                  className="w-16"
                  label="Stop position"
                  maxValue={100}
                  minValue={0}
                  onChange={(value) => {
                    const percent = Number.parseFloat(value);
                    if (!Number.isNaN(percent)) {
                      onStopPositionChange(index, percent / 100);
                    }
                  }}
                  type="number"
                  value={Math.round(stop.position * 100).toString()}
                />
                <ColorInput
                  className="flex-1"
                  onChange={(color) => onStopColorChange(index, color)}
                  onCommit={onCommit}
                  onDiscard={onDiscard}
                  onDragStart={onGestureStart}
                  value={stop.color}
                />
                <Button
                  aria-label="Remove stop"
                  disabled={gradient.stops.length <= 2}
                  onClick={() => onRemoveStop(index)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <TrashIcon />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ImageFillContent
          image={image}
          onResizeModeChange={onImageResizeModeChange}
          onUrlChange={onImageUrlChange}
        />
      )}
    </div>
  );
}

/**
 * The complete fill composite: the fill row (preview swatch + label + popover
 * trigger) and the fill editor popover (solid / gradient / image tabs). This is
 * the host-side kit target for the `fillField` wire node; the popover editor,
 * gradient stop rows and the org-scoped image picker all stay inside so the
 * wire never carries app context (router/auth/react-query).
 */
export function FillField({
  label,
  open,
  onOpenChange,
  ...content
}: FillFieldProps) {
  const previewType = content.isTypeMixed ? "solid" : content.backgroundType;

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label="Edit fill"
          className={cn(
            "flex h-7 flex-1 items-center gap-2 rounded-sm px-1.5 transition-colors dark:bg-input/60 dark:hover:bg-accent/50",
          )}
          type="button"
        >
          <FillPreviewSwatch
            color={content.backgroundColor}
            gradient={content.gradient}
            image={content.image}
            type={previewType}
          />
          <span className="truncate text-xs">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-2xl p-3" side="left" sideOffset={8}>
        <PopoverHeader title="Fill" onClose={() => onOpenChange(false)} />
        <FillEditorPopoverContent {...content} />
      </PopoverContent>
    </Popover>
  );
}

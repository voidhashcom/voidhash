"use client";

import type { BackgroundImage } from "@/features/studio/paywalls/designer/state/actions/features/fill-style-actions";

import { ImageFillContent } from "./fill-field";

type ResizeMode = BackgroundImage["resizeMode"];

/**
 * The host-side kit target for the `imageField` wire node. A thin standalone
 * wrapper over {@link ImageFillContent} (the image-tab body reused from the fill
 * composite): a preview tile that opens the org-scoped asset picker, a remove
 * affordance, and a resize-mode select. The wire node carries only the resolved
 * URL + resize mode; the picker's app context (router/auth/react-query) stays
 * inside {@link ImageFillContent}, never crossing the panel wire.
 *
 * The wire callbacks are split from the fill composite's single `onUrlChange`:
 * selecting a library asset fires {@link ImageFieldProps.onPick} with the picked
 * URL, the remove affordance fires {@link ImageFieldProps.onClear}, and the
 * resize-mode select fires {@link ImageFieldProps.onResizeModeChange}.
 */
export interface ImageFieldProps {
  /** The current image URL (already scheme-allowlisted by the renderer), or absent. */
  url?: string;
  /** How the image fits its box. */
  resizeMode?: ResizeMode;
  /** Fires with the picked asset URL when a library image is selected. */
  onPick?: (url: string) => void;
  /** Fires when the resize mode changes. */
  onResizeModeChange?: (mode: ResizeMode) => void;
  /** Fires when the image is removed. */
  onClear?: () => void;
}

export function ImageField({
  url,
  resizeMode = "cover",
  onPick,
  onResizeModeChange,
  onClear,
}: ImageFieldProps) {
  const image: BackgroundImage = { url: url ?? "", resizeMode };
  return (
    <ImageFillContent
      image={image}
      onResizeModeChange={(mode) => onResizeModeChange?.(mode)}
      onUrlChange={(next) => {
        if (next === "") {
          onClear?.();
        } else {
          onPick?.(next);
        }
      }}
    />
  );
}

"use client";

import { Effect } from "effect";
import { PipetteIcon } from "lucide-react";

export interface EyedropperButtonProps {
  onColorPick: (color: string) => void;
}

export function EyedropperButton({ onColorPick }: EyedropperButtonProps) {
  const handleEyedropper = async () => {
    if (!("EyeDropper" in window)) {
      return;
    }

    const hex = await Effect.runPromise(
      Effect.tryPromise(async (): Promise<string> => {
        // @ts-expect-error - EyeDropper API is not yet in TypeScript types
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        // Result is in format "#rrggbb"
        return result.sRGBHex.slice(1).toUpperCase();
      }).pipe(
        // User cancelled or API not supported — nothing to apply.
        Effect.orElseSucceed((): string | undefined => undefined),
      ),
    );
    if (hex !== undefined) {
      onColorPick(hex);
    }
  };

  if (!("EyeDropper" in window)) {
    return null;
  }

  return (
    <button
      aria-label="Pick color from screen"
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      onClick={handleEyedropper}
      type="button"
    >
      <PipetteIcon className="size-4" />
    </button>
  );
}

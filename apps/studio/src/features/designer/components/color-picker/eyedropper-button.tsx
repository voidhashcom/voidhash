'use client';

import { PipetteIcon } from 'lucide-react';

export type EyedropperButtonProps = {
  onColorPick: (color: string) => void;
};

export function EyedropperButton({ onColorPick }: EyedropperButtonProps) {
  const handleEyedropper = async () => {
    if (!('EyeDropper' in window)) {
      return;
    }

    try {
      // @ts-expect-error - EyeDropper API is not yet in TypeScript types
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      // Result is in format "#rrggbb"
      const hex = result.sRGBHex.slice(1).toUpperCase();
      onColorPick(hex);
    } catch {
      // User cancelled or API not supported
    }
  };

  if (!('EyeDropper' in window)) {
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

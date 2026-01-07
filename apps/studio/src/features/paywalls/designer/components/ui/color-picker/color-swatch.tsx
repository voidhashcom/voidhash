import { cn } from "@voidhash/ui";

import { CheckerboardBackground } from "./checkerboard-background";

export interface ColorSwatchProps {
  color: string;
  opacity?: number;
  className?: string;
}

export function ColorSwatch({
  color,
  opacity = 100,
  className,
}: ColorSwatchProps) {
  return (
    <div
      className={cn(
        "relative size-5 shrink-0 overflow-hidden rounded-[3px]",
        className
      )}
    >
      <CheckerboardBackground />
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: `#${color}`,
          opacity: opacity / 100,
        }}
      />
      <div className="absolute inset-0 rounded-[3px] ring-1 ring-white/20 ring-inset" />
    </div>
  );
}

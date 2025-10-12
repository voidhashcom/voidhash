"use client";

import { useRef } from "react";
import { useContainerDimensions } from "@/hooks/use-container-dimensions";

const IDEAL_STRIPE_WIDTH = 40;

function Stripe({ width, x }: { width: number; x: number }) {
  return (
    <div
      className="absolute top-0 left-0 h-full w-full border-background/50 border-r bg-gradient-to-r from-background/0 to-background/30"
      style={{
        width: width - 1,
        left: x,
      }}
    />
  );
}
export function RefractionStripes() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth } = useContainerDimensions(containerRef);
  const stripeCount = Math.floor(containerWidth / IDEAL_STRIPE_WIDTH);
  const stripeWidth = containerWidth / Math.max(1, stripeCount);

  return (
    <div className="absolute z-20 h-full w-full" ref={containerRef}>
      {Array.from({ length: stripeCount }).map((_, index) => (
        <Stripe
          // biome-ignore lint/suspicious/noArrayIndexKey: it is ok
          key={index}
          width={stripeWidth}
          x={index * stripeWidth}
        />
      ))}
    </div>
  );
}

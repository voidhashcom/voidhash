"use client";

import { HeroShader } from "@/components/hero-shader";
import { cn } from "@/lib/utils";

/** Renders the landing lenticular composition with the animated Perlin surface as its source. */
export function AuthLenticularBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none overflow-hidden", className)}>
      <HeroShader source="perlin" />
    </div>
  );
}

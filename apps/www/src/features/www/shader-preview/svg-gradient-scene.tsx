"use client";

import {
  HeroShader,
  type LenticularShaderSettings,
} from "@/features/www/hero/hero-shader";

/** Renders the production hero shader in a full-viewport tuning surface. */
export function SvgGradientScene({ settings = {} }: { settings?: LenticularShaderSettings }) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-black">
      <HeroShader settings={settings} />
    </div>
  );
}

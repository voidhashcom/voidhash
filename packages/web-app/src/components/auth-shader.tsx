import { lazy, Suspense, type ComponentProps } from "react";
import { type ShaderLabConfig } from "@basementstudio/shader-lab";

type ShaderLabCompositionProps = ComponentProps<
  typeof import("@basementstudio/shader-lab").ShaderLabComposition
>;

const ShaderLabComposition = import.meta.env.SSR
  ? null
  : lazy(async () => {
      const module = await import("@basementstudio/shader-lab");

      return {
        default: module.ShaderLabComposition,
      };
    });

const config: ShaderLabConfig = {
  layers: [
    {
      blendMode: "normal",
      compositeMode: "filter",
      maskConfig: {
        invert: false,
        mode: "multiply",
        source: "luminance",
      },
      hue: 1,
      id: "c111758c-4650-48be-85fc-a16b2b665dc8",
      kind: "effect",
      name: "Fluted Glass",
      opacity: 1,
      params: {
        preset: "painterly",
        frequency: 36,
        amplitude: 0.078,
        warp: 0,
        irregularity: 0,
        angle: 0,
      },
      saturation: 1.44,
      type: "fluted-glass",
      visible: true,
    },
    {
      blendMode: "normal",
      compositeMode: "filter",
      maskConfig: {
        invert: false,
        mode: "multiply",
        source: "luminance",
      },
      hue: 0,
      id: "99109d60-a6ce-44a8-9832-24905d6c14bb",
      kind: "effect",
      name: "Pattern",
      opacity: 0.42,
      params: {
        cellSize: 11,
        preset: "bars",
        colorMode: "source",
        monoColor: "#f5f5f0",
        bgOpacity: 0.16,
        invert: false,
        customColorCount: 4,
        customLuminanceBias: 0,
        customBgColor: "#F5F5F0",
        customColor1: "#0d1014",
        customColor2: "#4d5057",
        customColor3: "#969aa2",
        customColor4: "#e1e2de",
        bloomEnabled: true,
        bloomIntensity: 0.93,
        bloomThreshold: 0.13,
        bloomRadius: 9.5,
        bloomSoftness: 0.7,
      },
      saturation: 1.23,
      type: "pattern",
      visible: false,
    },
    {
      blendMode: "normal",
      compositeMode: "filter",
      maskConfig: {
        invert: false,
        mode: "multiply",
        source: "luminance",
      },
      hue: 0,
      id: "a924d323-7026-4b54-8738-355ef0d17009",
      kind: "source",
      name: "Gradient",
      opacity: 1,
      params: {
        preset: "custom",
        activePoints: 4,
        point1Color: "#09090B",
        point1Position: [-0.94, -0.26],
        point1Weight: 3,
        point2Color: "#005EFF",
        point2Position: [-0.49, 0.44999999999999996],
        point2Weight: 0.27,
        point3Color: "#B74394",
        point3Position: [0.8399999999999999, 0.6600000000000001],
        point3Weight: 0.07,
        point4Color: "#FF8400",
        point4Position: [1.15, 1.02],
        point4Weight: 0.6,
        point5Color: "#e6ebe0",
        point5Position: [0.6, -0.8],
        point5Weight: 1,
        noiseType: "turbulence",
        noiseSeed: 39.5,
        warpAmount: 0.04,
        warpScale: 0.28,
        warpIterations: 2,
        warpDecay: 1.2,
        warpBias: 0.5,
        vortexAmount: 0,
        animate: true,
        motionAmount: 0.51,
        motionSpeed: 0.21,
        falloff: 3.5,
        tonemapMode: "totos",
        glowStrength: 0,
        glowThreshold: 0,
        grainAmount: 0,
        vignetteStrength: 0,
        vignetteRadius: 0,
        vignetteSoftness: 0.74,
      },
      saturation: 1.52,
      type: "gradient",
      visible: true,
    },
  ],
  timeline: {
    duration: 8,
    loop: true,
    tracks: [],
  },
};

export function AuthShader() {
  if (!ShaderLabComposition) {
    return <div className="absolute inset-0 bg-[#09090b]" />;
  }

  return (
    <Suspense fallback={<div className="absolute inset-0 bg-[#09090b]" />}>
      <ShaderLabComposition config={config as ShaderLabCompositionProps["config"]} />
    </Suspense>
  );
}

import type { PathNodeData } from "@voidhash/mimic-schema";

export interface PathSvgAttributes {
  fill: string;
  fillRule: "nonzero" | "evenodd";
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  strokeLinecap: "butt" | "round" | "square";
  strokeLinejoin: "miter" | "round" | "bevel";
  opacity: number;
}

export function buildPathStyles(style: PathNodeData["data"]["style"]): PathSvgAttributes {
  return {
    fill: style.fillEnabled ? style.fillColor : "none",
    fillRule: style.fillRule,
    fillOpacity: style.fillOpacity,
    stroke: style.strokeEnabled ? style.strokeColor : "none",
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.strokeOpacity,
    strokeLinecap: style.strokeLinecap,
    strokeLinejoin: style.strokeLinejoin,
    opacity: style.opacity,
  };
}

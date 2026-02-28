import { Primitive } from "@voidhash/mimic";

import { createStateSchemaWithStyleOverrides } from "../states";
import {
  backgroundColor as fillColor,
  backgroundEnabled as fillEnabled,
  borderColor as strokeColor,
  borderEnabled as strokeEnabled,
  borderWidthTop as strokeWidth,
  display,
  opacity,
} from "../styles";
import { linkedVariables, localVariables } from "./base";

// Path-specific style properties
export const fillRule = Primitive.Either(
  Primitive.Literal("nonzero"),
  Primitive.Literal("evenodd")
).default("nonzero");

export const fillOpacity = Primitive.Number().default(1);

export const strokeOpacity = Primitive.Number().default(1);

export const strokeLinecap = Primitive.Either(
  Primitive.Literal("butt"),
  Primitive.Literal("round"),
  Primitive.Literal("square")
).default("butt");

export const strokeLinejoin = Primitive.Either(
  Primitive.Literal("miter"),
  Primitive.Literal("round"),
  Primitive.Literal("bevel")
).default("miter");

export const pathNodeStyleSchema = Primitive.Struct({
  fillColor,
  fillEnabled,
  // Fill extras
  fillRule,
  fillOpacity,
  strokeColor,
  strokeEnabled,
  strokeWidth,
  // Stroke extras
  strokeOpacity,
  strokeLinecap,
  strokeLinejoin,
  // Visual
  opacity,
  display,
});

export const pathNodeStateSchema = createStateSchemaWithStyleOverrides(
  pathNodeStyleSchema.partial({ stripDefaults: true }).default({}),
);

const pathNodeStates = Primitive.Array(pathNodeStateSchema).default([]);

/** PathNode tree node schema - represents an SVG path element */
export const PathNode = Primitive.TreeNode("path", {
  children: [] as const,
  data: Primitive.Struct({
    linkedVariables,
    localVariables,
    name: Primitive.String().default("Path"),
    states: pathNodeStates,
    // Path data (d attribute)
    d: Primitive.String().default(""),
    // Pre-computed transform from group flattening
    transform: Primitive.Either(
      Primitive.String(),
      Primitive.Literal(null)
    ).default(null),
    style: pathNodeStyleSchema,
  }),
});

export type PathNodeData = Primitive.TreeNodeSnapshot<typeof PathNode>;
export type PathNodeUpdateValue = Primitive.TreeNodeUpdateValue<typeof PathNode>;

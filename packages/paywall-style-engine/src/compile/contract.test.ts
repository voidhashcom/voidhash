import type { NodeType } from "@voidhash/mimic-schema";
import { describe, expect, it } from "vitest";

import { acceptanceOf, nodeDefaultStyle, nodeStyleFields, styleFieldSchema } from "../introspection.ts";
import { STYLE_GROUP_FLAG_BY_FIELD } from "../normalize.ts";
import { buildPathStyles } from "./path-styles.ts";
import { buildScrollViewStyles } from "./scroll-view-styles.ts";
import { buildShapeContainerStyles } from "./shape-styles.ts";
import { buildTextStyles } from "./text-styles.ts";
import { buildViewStyles } from "./view-styles.ts";
import { compileScreenStyles } from "./compile.ts";

/**
 * Style fields the compiler deliberately does NOT lower. Every entry is a
 * conscious decision — a field may appear here only with a reason. Anything not
 * listed must observably change the compiled output, so a new schema field can
 * never silently become editable-but-unrendered again.
 */
const FLEX_LONGHANDS_INERT = {
  flexGrow: "document path lowers only the `flex` shorthand today; longhands pending",
  flexShrink: "document path lowers only the `flex` shorthand today; longhands pending",
  flexBasis: "document path lowers only the `flex` shorthand today; longhands pending",
};

const DEAD_VISUALS_INERT = {
  zIndex: "no renderer consumer yet; candidate for schema removal",
  shadowEnabled: "shadow group has no renderer consumer; implement or remove",
  shadowColor: "shadow group has no renderer consumer; implement or remove",
  shadowOffsetX: "shadow group has no renderer consumer; implement or remove",
  shadowOffsetY: "shadow group has no renderer consumer; implement or remove",
  shadowRadius: "shadow group has no renderer consumer; implement or remove",
  shadowOpacity: "shadow group has no renderer consumer; implement or remove",
};

const SAFE_AREA_INERT = {
  safeAreaTop: "no renderer consumer yet; candidate for schema removal",
  safeAreaBottom: "no renderer consumer yet; candidate for schema removal",
};

const INTENTIONALLY_INERT: Partial<Record<NodeType, Record<string, string>>> = {
  screen: {
    x: "canvas placement, applied by the canvas transform, not node CSS",
    y: "canvas placement, applied by the canvas transform, not node CSS",
    flexGrow: "screens are canvas roots, never flex children; candidate for schema removal",
    flexShrink: "screens are canvas roots, never flex children; candidate for schema removal",
    flexBasis: "screens are canvas roots, never flex children; candidate for schema removal",
    ...DEAD_VISUALS_INERT,
    ...SAFE_AREA_INERT,
  },
  view: { ...FLEX_LONGHANDS_INERT, ...DEAD_VISUALS_INERT, ...SAFE_AREA_INERT },
  scrollView: { ...FLEX_LONGHANDS_INERT, ...DEAD_VISUALS_INERT, ...SAFE_AREA_INERT },
  text: { ...FLEX_LONGHANDS_INERT, ...DEAD_VISUALS_INERT, ...SAFE_AREA_INERT },
  shape: {
    ...FLEX_LONGHANDS_INERT,
    preserveAspectRatio: "applied to the inner <svg> element, not the container CSS",
  },
  path: {
    display: "path visibility is handled by the shape container's display",
  },
};

type Compile = (style: Record<string, unknown>) => unknown;

const COMPILERS: Partial<Record<NodeType, Compile>> = {
  view: (style) => buildViewStyles(style as never),
  text: (style) => buildTextStyles(style as never),
  shape: (style) => buildShapeContainerStyles(style as never),
  scrollView: (style) =>
    buildScrollViewStyles(style as never, { horizontal: false, showsScrollIndicator: true }),
  screen: (style) => compileScreenStyles(style as never, "editor-canvas"),
  path: (style) => buildPathStyles(style as never),
};

/** Companion fields a probe needs so the probed field can reach the output. */
const PROBE_COMPANIONS: Record<string, Record<string, unknown>> = {
  backgroundGradient: { backgroundType: "gradient" },
  backgroundImage: { backgroundType: "image" },
};

const PROBE_VALUES: Record<string, unknown> = {
  backgroundGradient: {
    kind: "linear",
    startX: 0,
    startY: 0,
    endX: 1,
    endY: 1,
    stops: [
      { color: "rgba(10, 20, 30, 1)", position: 0 },
      { color: "rgba(40, 50, 60, 1)", position: 1 },
    ],
  },
  backgroundImage: { url: "https://example.com/probe.png", resizeMode: "contain" },
};

function probeValueFor(type: NodeType, field: string, defaults: Record<string, unknown>): unknown {
  if (field in PROBE_VALUES) return PROBE_VALUES[field];
  const schema = styleFieldSchema(type, field);
  if (schema === undefined) return undefined;
  const acc = acceptanceOf(schema);
  const current = defaults[field];

  if (acc.literals.length > 0) {
    const other = acc.literals.find((literal) => literal !== current);
    if (other !== undefined && !acc.acceptsNumber) return other;
  }
  if (acc.acceptsNumber) {
    const base = typeof current === "number" ? current : 0;
    const candidate = base + 7;
    const min = acc.min ?? Number.NEGATIVE_INFINITY;
    return Math.max(candidate, min);
  }
  if (acc.acceptsBoolean || typeof current === "boolean") return current !== true;
  if (acc.acceptsString) return "rgba(7, 17, 27, 0.7)";
  return undefined;
}

describe("compile contract: every style field is lowered or explicitly inert", () => {
  for (const [type, compile] of Object.entries(COMPILERS) as [NodeType, Compile][]) {
    it(`covers every ${type} style field`, () => {
      const defaults = nodeDefaultStyle(type);
      const inert = INTENTIONALLY_INERT[type] ?? {};
      const baseline = compile(defaults);
      const unaccounted: string[] = [];
      const needlesslyListed: string[] = [];

      for (const field of nodeStyleFields(type)) {
        const probe = probeValueFor(type, field, defaults);
        expect(probe, `no probe value derivable for ${type}.${field}`).toBeDefined();

        // Defaults materialize explicit `*Enabled: false` flags, so a gated
        // field can only reach the output with its group flag forced on — both
        // in the probe and in the baseline it is compared against.
        const groupFlag = STYLE_GROUP_FLAG_BY_FIELD[field];
        const companions: Record<string, unknown> = {
          ...(groupFlag !== undefined && field !== groupFlag ? { [groupFlag]: true } : {}),
          ...PROBE_COMPANIONS[field],
        };
        const probedStyle = { ...defaults, ...companions, [field]: probe };
        const companionBaseline =
          Object.keys(companions).length > 0
            ? compile({ ...defaults, ...companions })
            : baseline;

        const changed =
          JSON.stringify(compile(probedStyle)) !== JSON.stringify(companionBaseline);

        if (!changed && !(field in inert)) unaccounted.push(field);
        if (changed && field in inert) needlesslyListed.push(field);
      }

      expect(unaccounted, "fields silently ignored by the compiler").toEqual([]);
      expect(needlesslyListed, "fields listed inert but actually lowered").toEqual([]);
    });
  }
});

import { type NodeType } from "@voidhash/mimic-schema";
import { describe, expect, test } from "vitest";

import { acceptanceOf, nodeStyleFields, nodeStyleSchema } from "./mimic-introspection.ts";
import { STYLE_GROUP_FLAG_BY_FIELD } from "./style-group-flags.ts";

/**
 * Schema CONTRACT test for {@link STYLE_GROUP_FLAG_BY_FIELD}. It re-derives the
 * expected set of gated trigger fields straight from the live mimic style schema,
 * so a new gated `background`/`border`/`shadow`/`fill`/`stroke` field forces a
 * conscious edit to the map instead of silently going un-enabled on the AI path.
 */

const STYLED_NODE_TYPES: readonly NodeType[] = ["screen", "view", "text", "shape", "path"];
const GROUP_PREFIXES = ["background", "border", "shadow", "fill", "stroke"] as const;

/**
 * The four border radius fields are ungated in the renderer, so they must NOT be
 * triggers (rounding a corner shouldn't switch on the border stroke).
 */
const UNGATED_RADIUS_FIELDS = new Set([
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
]);

/** Fields that name a gated style group but are the group's own `*Enabled` flag. */
const isFlagField = (field: string): boolean => field.endsWith("Enabled");

/** The gated trigger fields the schema declares for a node type. */
function expectedTriggersOf(type: NodeType): string[] {
  return nodeStyleFields(type).filter(
    (field) =>
      GROUP_PREFIXES.some((prefix) => field.startsWith(prefix)) &&
      !isFlagField(field) &&
      !UNGATED_RADIUS_FIELDS.has(field),
  );
}

describe("STYLE_GROUP_FLAG_BY_FIELD — schema contract", () => {
  for (const type of STYLED_NODE_TYPES) {
    test(`covers exactly the gated trigger fields of \`${type}\``, () => {
      const styleFields = new Set(nodeStyleFields(type));
      const mapTriggersForType = Object.keys(STYLE_GROUP_FLAG_BY_FIELD).filter((field) =>
        styleFields.has(field),
      );
      expect(new Set(mapTriggersForType)).toEqual(new Set(expectedTriggersOf(type)));
    });
  }

  test("every mapped flag is a real boolean style field on some node type", () => {
    for (const flag of new Set(Object.values(STYLE_GROUP_FLAG_BY_FIELD))) {
      const isBooleanFieldSomewhere = STYLED_NODE_TYPES.some((type) => {
        const schema = nodeStyleSchema(type)?.fields[flag];
        return schema !== undefined && acceptanceOf(schema).acceptsBoolean;
      });
      expect(isBooleanFieldSomewhere, `flag "${flag}" is not a boolean style field`).toBe(true);
    }
  });

  test("no trigger key is itself an `*Enabled` flag field", () => {
    for (const key of Object.keys(STYLE_GROUP_FLAG_BY_FIELD)) {
      expect(isFlagField(key)).toBe(false);
    }
  });
});

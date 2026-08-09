import { constant } from "@voidhash/lib/lang";
import { applyBatch, Primitive, validate } from "@voidhash/mimic-core";
import { describe, expect, test } from "vite-plus/test";

import {
  createStateSchemaWithStyleAndActionOverrides,
  createStateSchemaWithStyleOverrides,
} from "./states.ts";

/**
 * Feeds a deliberately ill-typed payload to a typed proxy setter: the mimic
 * proxies reject unknown keys at the type level, so the negative test that
 * asserts the runtime strips them has to bypass the compile-time shape.
 */
function isIllTyped<T>(value: unknown): value is T {
  return value !== undefined;
}

function illTyped<T>(value: Record<string, unknown>, use: (value: T) => void): void {
  if (isIllTyped<T>(value)) {
    use(value);
  }
}

const baseCondition = {
  type: constant("or"),
  value: [
    {
      type: constant("and"),
      value: [
        {
          type: constant("equals"),
          value: {
            left: {
              type: constant("literal"),
              value: { key: constant("boolean"), value: true },
            },
            right: {
              type: constant("literal"),
              value: { key: constant("boolean"), value: true },
            },
          },
        },
      ],
    },
  ],
};

const testStyleSchema = Primitive.Struct({
  backgroundColor: Primitive.String().default("rgba(0, 0, 0, 1)"),
  width: Primitive.Number().default(100),
});

const stateWithStyleOverridesSchema = createStateSchemaWithStyleOverrides(
  testStyleSchema.partial({ stripDefaults: true }).default({}),
);

const stateWithStyleAndActionOverridesSchema = createStateSchemaWithStyleAndActionOverrides(
  testStyleSchema.partial({ stripDefaults: true }).default({}),
);

const baseInput = {
  condition: baseCondition,
  id: "state-1",
  name: "Hovered",
};

function buildStyleStateSnapshot(
  build: (root: Primitive.InferProxy<typeof stateWithStyleOverridesSchema>) => void,
) {
  const base = validate(
    stateWithStyleOverridesSchema.schema,
    stateWithStyleOverridesSchema.encode(baseInput),
  )!;
  const commands = Primitive.commands(stateWithStyleOverridesSchema, base, build);
  return stateWithStyleOverridesSchema.decode(applyBatch(base, commands))!;
}

function buildStyleAndActionStateSnapshot(
  build: (root: Primitive.InferProxy<typeof stateWithStyleAndActionOverridesSchema>) => void,
) {
  const base = validate(
    stateWithStyleAndActionOverridesSchema.schema,
    stateWithStyleAndActionOverridesSchema.encode(baseInput),
  )!;
  const commands = Primitive.commands(stateWithStyleAndActionOverridesSchema, base, build);
  return stateWithStyleAndActionOverridesSchema.decode(applyBatch(base, commands))!;
}

describe("state schemas", () => {
  test("fills style overrides with defaults", () => {
    const snapshot = buildStyleStateSnapshot(() => {});

    expect(snapshot.id).toBe("state-1");
    expect(snapshot.name).toBe("Hovered");
    expect(snapshot.overrides.style).toEqual({});
  });

  test("fills style and action overrides with defaults", () => {
    const snapshot = buildStyleAndActionStateSnapshot(() => {});

    expect(snapshot.overrides.style).toEqual({});
    expect(snapshot.overrides.actions).toEqual([]);
  });

  test("accepts typed style override values", () => {
    const snapshot = buildStyleStateSnapshot((root) => {
      root.overrides.style.update({
        backgroundColor: "rgba(255, 0, 0, 1)",
        width: 240,
      });
    });

    expect(snapshot.overrides.style).toEqual({
      backgroundColor: "rgba(255, 0, 0, 1)",
      width: 240,
    });
  });

  test("strips defaults from style overrides", () => {
    const snapshot = buildStyleStateSnapshot((root) => {
      root.overrides.style.update({ width: 240 });
      root.overrides.style.update({ width: undefined });
    });

    expect(snapshot.overrides.style).toEqual({});
  });

  test("ignores unknown style override keys", () => {
    const snapshot = buildStyleStateSnapshot((root) => {
      illTyped<never>({ unknownKey: 123 }, (value) => {
        root.overrides.style.update(value);
      });
    });

    expect(snapshot.overrides.style).toEqual({});
  });

  test("accepts action overrides", () => {
    const snapshot = buildStyleAndActionStateSnapshot((root) => {
      root.overrides.actions.push({
        action: { type: "none" },
        interactionId: "interaction-1",
      });
    });

    expect(snapshot.overrides.actions[0]?.value?.action.type).toBe("none");
  });
});

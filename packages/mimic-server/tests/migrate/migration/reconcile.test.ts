import { describe, expect, it } from "vitest";

import { Primitive } from "@voidhash/mimic-core";

import { reconcileMigrationValue } from "../../../src/migrate/index.js";

describe("migration reconcile", () => {
  it("prunes removed fields and materializes defaults from the new schema", () => {
    const oldPrimitive = Primitive.Struct({
      title: Primitive.String().required(),
      notes: Primitive.String(),
    });
    const newPrimitive = Primitive.Struct({
      title: Primitive.String().required(),
      done: Primitive.Boolean().default(false),
    });

    const result = reconcileMigrationValue({
      oldSchema: oldPrimitive.schema,
      newSchema: newPrimitive.schema,
      value: oldPrimitive.encode({
        title: "Write tests",
        notes: "legacy field",
      }),
    });

    expect(result).toEqual({
      ok: true,
      value: newPrimitive.encode({
        title: "Write tests",
        done: false,
      }),
    });
  });

  it("fails when required new data cannot be derived", () => {
    const oldPrimitive = Primitive.Struct({
      title: Primitive.String().required(),
    });
    const newPrimitive = Primitive.Struct({
      title: Primitive.String().required(),
      slug: Primitive.String().required(),
    });

    const result = reconcileMigrationValue({
      oldSchema: oldPrimitive.schema,
      newSchema: newPrimitive.schema,
      value: oldPrimitive.encode({
        title: "Write tests",
      }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("required-field-without-default");
    expect(result.error.path).toBe("root.slug");
  });
});

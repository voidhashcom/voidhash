import { describe, expect, expectTypeOf, it } from "vitest";
import { Primitive, applyBatch, validate } from "../../src/index.js";

describe("primitives struct", () => {
  it("builds object schemas from field primitives", () => {
    const User = Primitive.Struct({
      name: Primitive.String().required(),
      active: Primitive.Boolean().default(false),
    });

    expect(User.schema).toEqual({
      kind: "object",
      fields: {
        name: { kind: "string", required: true },
        active: { kind: "boolean", default: { kind: "boolean", value: false } },
      },
    });
  });

  it("encodes defaults and supports nested field updates", () => {
    const User = Primitive.Struct({
      name: Primitive.String().required(),
      profile: Primitive.Struct({
        title: Primitive.String().default("member"),
      }),
      active: Primitive.Boolean().default(false),
    });

    const snapshot = User.encode({
      name: "Alice",
      profile: {},
    });

    const commands = Primitive.commands(User, snapshot, (root) => {
      root.name.set("Bob");
      root.profile.update({ title: "admin" });
      root.update({ active: undefined });
    });

    const next = applyBatch(snapshot, commands);
    const decoded = User.decode(next);

    expect(decoded).toEqual({
      name: "Bob",
      profile: { title: "admin" },
    });
  });

  it("makes child fields optional via partial", () => {
    const User = Primitive.Struct({
      name: Primitive.String().required().default("Anonymous"),
      email: Primitive.String().required(),
    }).partial({ stripDefaults: true });

    expect(User.encode({})).toEqual({
      kind: "object",
      fields: {},
    });
  });

  describe("update input typing", () => {
    const User = Primitive.Struct({
      name: Primitive.String().required(),
      nickname: Primitive.String(),
      active: Primitive.Boolean().default(false),
      profile: Primitive.Struct({
        title: Primitive.String().required(),
        bio: Primitive.String(),
      }),
    });
    type UpdateInput = Primitive.InferUpdateInput<typeof User>;

    it("declares deletion only for optional and defaulted fields", () => {
      expectTypeOf<Required<UpdateInput>["name"]>().toEqualTypeOf<string>();
      expectTypeOf<Required<UpdateInput>["nickname"]>().toEqualTypeOf<string | undefined>();
      expectTypeOf<Required<UpdateInput>["active"]>().toEqualTypeOf<boolean | undefined>();
    });

    it("rejects update calls deleting a required field without a default", () => {
      // Never invoked — type-level pin that the calls below fail to compile.
      const _rejected = (root: Primitive.InferProxy<typeof User>) => {
        // @ts-expect-error name is required without a default and cannot be deleted
        root.update({ name: undefined });
        // @ts-expect-error nested required-without-default fields cannot be deleted either
        root.update({ profile: { title: undefined } });
      };
      expect(typeof _rejected).toBe("function");
    });

    it("deletes optional fields and re-materializes defaulted fields on update", () => {
      const snapshot = User.encode({
        name: "Alice",
        nickname: "Al",
        active: true,
        profile: { title: "Dev" },
      });

      const commands = Primitive.commands(User, snapshot, (root) => {
        root.update({ nickname: undefined, active: undefined });
        root.update({ profile: { bio: undefined } });
      });

      const next = validate(User.schema, applyBatch(snapshot, commands));
      expect(User.decode(next)).toEqual({
        name: "Alice",
        active: false,
        profile: { title: "Dev" },
      });
    });
  });

  describe("partial/extend default typing", () => {
    type HasUndefined<T> = undefined extends T ? true : false;
    const Defaulted = Primitive.Struct({ title: Primitive.String() }).default({});

    it("drops the struct default from the partial() result type", () => {
      const Partialed = Defaulted.partial({ stripDefaults: true });
      expectTypeOf<HasUndefined<Primitive.InferSnapshot<typeof Partialed>>>().toEqualTypeOf<true>();
      expect("default" in Partialed.schema).toBe(false);

      const Restored = Defaulted.partial({ stripDefaults: true }).default({});
      expectTypeOf<HasUndefined<Primitive.InferSnapshot<typeof Restored>>>().toEqualTypeOf<false>();
    });

    it("drops the struct default from the extend() result type", () => {
      const Extended = Defaulted.extend({ extra: Primitive.String() });
      expectTypeOf<HasUndefined<Primitive.InferSnapshot<typeof Extended>>>().toEqualTypeOf<true>();
      expect("default" in Extended.schema).toBe(false);

      const Restored = Defaulted.extend({ extra: Primitive.String() }).default({});
      expectTypeOf<HasUndefined<Primitive.InferSnapshot<typeof Restored>>>().toEqualTypeOf<false>();
    });
  });
});

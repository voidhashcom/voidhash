import { describe, expect, expectTypeOf, it } from "vitest";
import { Primitive } from "../../src/index.js";

type EmptyObject = {};

type IsOptionalKey<T, K extends keyof T> = EmptyObject extends Pick<T, K> ? true : false;

type HasUndefined<T> = undefined extends T ? true : false;

describe("snapshot typing", () => {
  describe("struct fields", () => {
    const User = Primitive.Struct({
      name: Primitive.String().required(),
      active: Primitive.Boolean().default(false),
      age: Primitive.Number(),
      role: Primitive.Literal("admin").default("admin"),
    });
    type Snapshot = NonNullable<Primitive.InferSnapshot<typeof User>>;

    it("snapshots required fields as non-optional", () => {
      expectTypeOf<Snapshot["name"]>().toEqualTypeOf<string>();
      expectTypeOf<IsOptionalKey<Snapshot, "name">>().toEqualTypeOf<false>();
    });

    it("snapshots defaulted fields as non-optional", () => {
      expectTypeOf<Snapshot["active"]>().toEqualTypeOf<boolean>();
      expectTypeOf<IsOptionalKey<Snapshot, "active">>().toEqualTypeOf<false>();
      expectTypeOf<Snapshot["role"]>().toEqualTypeOf<"admin">();
      expectTypeOf<IsOptionalKey<Snapshot, "role">>().toEqualTypeOf<false>();
    });

    it("keeps optional-without-default fields optional", () => {
      expectTypeOf<Snapshot["age"]>().toEqualTypeOf<number | undefined>();
      expectTypeOf<IsOptionalKey<Snapshot, "age">>().toEqualTypeOf<true>();
    });

    it("decodes defaults materialized by encode", () => {
      const decoded = User.encode({ name: "Alice" });
      expect(User.decode(decoded)).toEqual({
        name: "Alice",
        active: false,
        role: "admin",
      });
    });
  });

  describe("struct snapshot presence", () => {
    it("keeps a plain struct snapshot possibly undefined", () => {
      const Profile = Primitive.Struct({ title: Primitive.String() });
      expectTypeOf<HasUndefined<Primitive.InferSnapshot<typeof Profile>>>().toEqualTypeOf<true>();
    });

    it("makes required and defaulted struct snapshots non-undefined", () => {
      const RequiredProfile = Primitive.Struct({ title: Primitive.String() }).required();
      expectTypeOf<
        HasUndefined<Primitive.InferSnapshot<typeof RequiredProfile>>
      >().toEqualTypeOf<false>();

      const DefaultedProfile = Primitive.Struct({ title: Primitive.String() }).default({});
      expectTypeOf<
        HasUndefined<Primitive.InferSnapshot<typeof DefaultedProfile>>
      >().toEqualTypeOf<false>();
    });

    it("threads nested struct optionality into the parent snapshot", () => {
      const Doc = Primitive.Struct({
        profile: Primitive.Struct({ title: Primitive.String().default("member") }).default({}),
        settings: Primitive.Struct({ dark: Primitive.Boolean() }).required(),
        meta: Primitive.Struct({ tag: Primitive.String() }),
      });
      type Snapshot = NonNullable<Primitive.InferSnapshot<typeof Doc>>;

      expectTypeOf<IsOptionalKey<Snapshot, "profile">>().toEqualTypeOf<false>();
      expectTypeOf<Snapshot["profile"]["title"]>().toEqualTypeOf<string>();
      expectTypeOf<IsOptionalKey<Snapshot, "settings">>().toEqualTypeOf<false>();
      expectTypeOf<IsOptionalKey<Snapshot, "meta">>().toEqualTypeOf<true>();
    });
  });

  describe("either fields", () => {
    it("snapshots a defaulted either as non-optional", () => {
      const Width = Primitive.Either(Primitive.Number(), Primitive.Literal("auto")).default(100);
      expectTypeOf<Primitive.InferSnapshot<typeof Width>>().toEqualTypeOf<number | "auto">();
    });

    it("keeps a plain either optional", () => {
      const Width = Primitive.Either(Primitive.Number(), Primitive.Literal("auto"));
      expectTypeOf<Primitive.InferSnapshot<typeof Width>>().toEqualTypeOf<
        number | "auto" | undefined
      >();
    });
  });

  describe("array and union fields", () => {
    it("snapshots required/defaulted arrays and unions as non-optional struct fields", () => {
      const Variant = Primitive.Struct({ label: Primitive.String().required() });
      const Doc = Primitive.Struct({
        tags: Primitive.Array(Primitive.String().required()).required(),
        history: Primitive.Array(Primitive.Number()).default([]),
        extras: Primitive.Array(Primitive.String()),
        kind: Primitive.Union({ a: Variant }).required(),
        fallbackKind: Primitive.Union({ a: Variant }),
      });
      type Snapshot = NonNullable<Primitive.InferSnapshot<typeof Doc>>;

      expectTypeOf<IsOptionalKey<Snapshot, "tags">>().toEqualTypeOf<false>();
      expectTypeOf<Snapshot["tags"]>().toEqualTypeOf<
        readonly Primitive.ArrayEntrySnapshot<string>[]
      >();
      expectTypeOf<IsOptionalKey<Snapshot, "history">>().toEqualTypeOf<false>();
      expectTypeOf<IsOptionalKey<Snapshot, "extras">>().toEqualTypeOf<true>();
      expectTypeOf<IsOptionalKey<Snapshot, "kind">>().toEqualTypeOf<false>();
      expectTypeOf<IsOptionalKey<Snapshot, "fallbackKind">>().toEqualTypeOf<true>();
    });
  });

  describe("tree node data", () => {
    const FlexData = Primitive.Struct({
      title: Primitive.String().required(),
      gap: Primitive.Number().default(0),
      hint: Primitive.String(),
    }).required();
    const FlexNode = Primitive.TreeNode("flex", { data: FlexData, children: [] });
    const Doc = Primitive.Tree({ root: FlexNode });

    it("snapshots required node data as non-optional", () => {
      type NodeSnapshot = NonNullable<Primitive.InferSnapshot<typeof Doc>>[number];
      expectTypeOf<HasUndefined<NodeSnapshot["data"]>>().toEqualTypeOf<false>();
      expectTypeOf<NodeSnapshot["data"]["title"]>().toEqualTypeOf<string>();
      expectTypeOf<NodeSnapshot["data"]["gap"]>().toEqualTypeOf<number>();
      expectTypeOf<NodeSnapshot["data"]["hint"]>().toEqualTypeOf<string | undefined>();
    });

    it("keeps an absent tree snapshot possibly undefined", () => {
      expectTypeOf<HasUndefined<Primitive.InferSnapshot<typeof Doc>>>().toEqualTypeOf<true>();
    });

    it("types node update as the partial struct-update input", () => {
      type UpdateArg = Parameters<Primitive.TypedNodeProxy<typeof FlexNode>["update"]>[0];

      expectTypeOf<Record<string, never>>().toExtend<UpdateArg>();
      expectTypeOf<{ gap: number }>().toExtend<UpdateArg>();
      expectTypeOf<{ hint: undefined }>().toExtend<UpdateArg>();
      expectTypeOf<{ title: string; gap: number; hint: string }>().toExtend<UpdateArg>();
      expectTypeOf<UpdateArg>().toEqualTypeOf<
        Primitive.InferUpdateInput<Primitive.InferTreeNodeData<typeof FlexNode>>
      >();
    });

    it("applies partial node updates at runtime", () => {
      const initial = Doc.encode([{ type: "flex", title: "Root", children: [] }]);
      const commands = Primitive.commands(Doc, initial, (root) => {
        root.children.first()!.update({ gap: 12 });
      });
      expect(commands.length).toBeGreaterThan(0);
    });
  });
});

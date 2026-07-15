import { Primitive } from "@voidhash/mimic-core";

/**
 * Presence primitive for the paywall designer. `cursor` is optional — absence
 * means the user has no active cursor (the former `null` encoding).
 */
export const PresenceSchema = Primitive.Struct({
  cursor: Primitive.Struct({
    x: Primitive.Number().required(),
    y: Primitive.Number().required(),
  }),
  name: Primitive.String(),
  participant: Primitive.Union(
    {
      agent: Primitive.Struct({
        editSessionId: Primitive.String().required(),
        kind: Primitive.Literal("agent").required(),
        source: Primitive.Either(
          Primitive.Literal("built_in"),
          Primitive.Literal("mcp"),
        ).required(),
      }),
      human: Primitive.Struct({
        kind: Primitive.Literal("human").required(),
      }),
    },
    { discriminator: "kind" },
  ).required(),
  selectedNodeIds: Primitive.Array(Primitive.String()).default([]),
  user: Primitive.Struct({
    color: Primitive.String().required(),
    name: Primitive.String().required(),
  }).required(),
});

/** Input accepted when seeding or setting presence (defaults applied on encode). */
export type PresenceInput = NonNullable<Primitive.InferInput<typeof PresenceSchema>>;

/** Decoded presence value as observed for any connected participant. */
export type PresenceSnapshot = NonNullable<Primitive.InferSnapshot<typeof PresenceSchema>>;

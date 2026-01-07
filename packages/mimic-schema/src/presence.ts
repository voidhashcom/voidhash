import { Presence } from "@voidhash/mimic";
import { Schema } from "effect";

export const PresenceSchema = Presence.make({
  schema: Schema.Struct({
    cursor: Schema.NullOr(
      Schema.Struct({
        x: Schema.Number,
        y: Schema.Number,
      })
    ),

    name: Schema.optional(Schema.String),
    selectedNodeIds: Schema.Array(Schema.String),
    user: Schema.Struct({
      color: Schema.String,
      name: Schema.String,
    }),
  }),
});

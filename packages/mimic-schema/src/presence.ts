import { Presence } from '@voidhash/mimic';
import { Schema } from 'effect';

export const PresenceSchema = Presence.make({
  schema: Schema.Struct({
    name: Schema.optional(Schema.String),

    cursor: Schema.NullOr(
      Schema.Struct({
        x: Schema.Number,
        y: Schema.Number
      })
    ),
    user: Schema.Struct({
      name: Schema.String,
      color: Schema.String
    }),
    selectedNodeIds: Schema.Array(Schema.String)
  })
});

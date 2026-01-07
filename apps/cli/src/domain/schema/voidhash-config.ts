import { Schema } from "effect";

export const VoidhashConfigSchema = Schema.Struct({
  project: Schema.String,
  schema: Schema.String,
  team: Schema.String,
});

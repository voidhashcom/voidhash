import { Schema } from 'effect';

export const VoidhashConfigSchema = Schema.Struct({
  schema: Schema.String,
  team: Schema.String,
  project: Schema.String
});

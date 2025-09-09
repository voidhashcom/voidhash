import { Schema } from 'effect';

export const ConfigSchema = Schema.Struct({
  apiKey: Schema.NullishOr(Schema.String)
});

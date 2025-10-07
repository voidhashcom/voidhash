import { Schema } from 'effect';

export const CliConfigSchema = Schema.Struct({
  apiKey: Schema.NullishOr(Schema.String)
});

import { Schema } from "effect";

export const CliConfigSchema = Schema.Struct({
  api_key: Schema.NullishOr(Schema.String),
  api_url: Schema.String,
  web_url: Schema.String,
});

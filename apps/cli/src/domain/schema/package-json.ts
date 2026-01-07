import { Schema } from "effect";

export const PackageJsonSchema = Schema.Struct({
  dependencies: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String })
  ),
  devDependencies: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String })
  ),
  name: Schema.optional(Schema.String),
  peerDependencies: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String })
  ),
  version: Schema.optional(Schema.String),
  workspaces: Schema.optional(
    Schema.Union(
      Schema.Array(Schema.String),
      Schema.Record({ key: Schema.String, value: Schema.Unknown })
    )
  ),
});

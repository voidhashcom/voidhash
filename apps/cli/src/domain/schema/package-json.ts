import { Schema } from 'effect';

export const PackageJsonSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
  dependencies: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String })
  ),
  devDependencies: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String })
  ),
  peerDependencies: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String })
  ),
  workspaces: Schema.optional(
    Schema.Union(
      Schema.Array(Schema.String),
      Schema.Record({ key: Schema.String, value: Schema.Unknown })
    )
  )
});

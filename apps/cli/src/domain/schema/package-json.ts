import * as Schema from "effect/Schema";

export const PackageJson = Schema.Struct({
  dependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  devDependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  name: Schema.optional(Schema.String),
  peerDependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  version: Schema.optional(Schema.String),
  workspaces: Schema.optional(
    Schema.Union([Schema.Array(Schema.String), Schema.Record(Schema.String, Schema.Unknown)]),
  ),
});
export type PackageJson = typeof PackageJson.Type;

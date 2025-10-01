import { HelpDoc, ValidationError } from '@effect/cli';
import { FileSystem, Path } from '@effect/platform';
import { Data, Effect, Schema } from 'effect';

export class PackageJsonNotFoundError extends Data.TaggedError(
  'PackageJsonNotFoundError'
)<{
  readonly message: string;
}> {}

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

export const loadPackageJson = (basePath = './') =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const packageJsonPath = path.resolve(basePath, 'package.json');
    const packageJsonExists = yield* fs.exists(packageJsonPath);
    if (!packageJsonExists) {
      return yield* Effect.fail(
        ValidationError.invalidValue(
          HelpDoc.p(
            'React Native project not found in this directory. Please re-run the command in the root of the React Native project.'
          )
        )
      );
    }
    const packageJson = yield* fs.readFileString(packageJsonPath);
    return yield* Schema.decodeUnknown(PackageJsonSchema)(
      JSON.parse(packageJson)
    );
  });

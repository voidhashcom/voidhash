import { HelpDoc, ValidationError } from '@effect/cli';
import { FileSystem, Path } from '@effect/platform';
import { Data, Effect, Schema } from 'effect';
import { safeRegister } from './js-file-loading';

export class VoidhashConfigNotFoundError extends Data.TaggedError(
  'VoidhashConfigNotFoundError'
)<{
  readonly message: string;
}> {}

export const VoidhashConfigSchema = Schema.Struct({
  schema: Schema.String,
  team: Schema.String,
  project: Schema.String
});

export const loadVoidhashConfig = () => {
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;

    const possibleVoidhashConfigPaths = [
      path.resolve('./voidhash.config.ts'),
      path.resolve('./voidhash.config.js'),
      path.resolve('./voidhash.config.cjs'),
      path.resolve('./voidhash.config.mjs')
    ];

    const existingPaths = yield* Effect.all(
      possibleVoidhashConfigPaths.map((path) =>
        Effect.gen(function* () {
          const exists = yield* fs.exists(path);
          return { path, exists };
        })
      ),
      {
        concurrency: 'unbounded'
      }
    );

    const existingPath = existingPaths.find((path) => path.exists)?.path;
    if (!existingPath) {
      return yield* Effect.fail(
        new VoidhashConfigNotFoundError({
          message: 'Voidhash config not found'
        })
      );
    }

    const absolutePath = path.resolve(existingPath);
    const { unregister } = yield* safeRegister();
    const required = require(absolutePath);
    unregister();
    const content = required.default ?? required;
    return yield* Schema.decodeUnknown(VoidhashConfigSchema)(content);
  }).pipe(
    Effect.catchTags({
      ParseError: () =>
        Effect.fail(
          ValidationError.invalidValue(
            HelpDoc.p(
              'Could not parse voidhash config. Please check your voidhash.config.(ts|js|cjs|mjs) file is valid.'
            )
          )
        )
    })
  );
};

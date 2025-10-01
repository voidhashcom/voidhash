import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';

export const detectSrcLanguage = () =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;

    // Check if tsconfig.json exists
    const tsconfigPath = path.resolve('./tsconfig.json');
    const tsconfigExists = yield* fs.exists(tsconfigPath);
    if (tsconfigExists) {
      return 'ts';
    }

    return 'js';
  });

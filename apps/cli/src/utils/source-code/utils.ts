import { FileSystem, Path } from '@effect/platform';
import { Effect, type Schema } from 'effect';
import type { PackageJsonSchema } from './package-json';

/**
 * Returns a relative path prefix based on the given directory depth.
 *
 * @param depth - The number of directory levels to go up.
 * @returns The relative path prefix (e.g., './' for 0, '../' for 1, etc.).
 */
export const relativePathPrefixFromDepth = (depth: number) => {
  return depth === 0 ? './' : `${'../'.repeat(depth)}`;
};

/**
 * Determines the source directory path for the project.
 *
 * Checks if a './src' directory exists in the current working directory.
 * If it exists, returns the absolute path to './src'.
 * Otherwise, returns the absolute path to the current directory ('./').
 *
 * @returns {Effect.Effect<string, never, FileSystem | Path>} An Effect that yields the resolved source directory path.
 */
export const retrieveSrcDir = () =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const srcDir = path.resolve('./src');
    const srcDirExists = yield* fs.exists(srcDir);
    if (srcDirExists) {
      return srcDir;
    }
    return path.resolve('./');
  });

/**
 * Checks if the project is an Expo project.
 *
 * @param packageJson - The package.json contents.
 * @returns True if the project is an Expo project, false otherwise.
 */
export const checkIsExpoProject = (
  packageJson: Schema.Schema.Type<typeof PackageJsonSchema>
) => {
  return packageJson.dependencies?.expo !== undefined;
};

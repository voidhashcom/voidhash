import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import { loadPackageJson } from './package-json';
import { relativePathPrefixFromDepth } from './utils';

export const detectMonorepoRootPath = (maxDepth = 10) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const checkIsMonorepoRoot = (depth: number) =>
      Effect.gen(function* () {
        const pathPrefix = relativePathPrefixFromDepth(depth);

        // Check for monorepo indicators
        const isPnpmWorkspace = yield* fs.exists(
          path.resolve(pathPrefix, 'pnpm-workspace.yaml')
        );
        const isYarnWorkspaces = yield* fs.exists(
          path.resolve(pathPrefix, 'yarn.workspaces.json')
        );
        const isTurboRoot = yield* fs.exists(
          path.resolve(pathPrefix, 'turbo.json')
        );

        // Check for package.json with workspaces field
        const packageJsonPath = path.resolve(pathPrefix, 'package.json');
        const packageJsonExists = yield* fs.exists(packageJsonPath);
        let hasWorkspacesField = false;

        if (packageJsonExists) {
          const packageJson = yield* loadPackageJson(pathPrefix);
          hasWorkspacesField =
            (packageJson.workspaces !== undefined &&
              Array.isArray(packageJson.workspaces)) ||
            (packageJson.workspaces !== undefined &&
              typeof packageJson.workspaces === 'object');
        }

        return (
          isPnpmWorkspace ||
          isYarnWorkspaces ||
          isTurboRoot ||
          hasWorkspacesField
        );
      });

    // Check current directory and traverse up
    for (let depth = 0; depth <= maxDepth; depth++) {
      const isMonorepoRoot = yield* checkIsMonorepoRoot(depth);
      if (isMonorepoRoot) {
        const pathPrefix = relativePathPrefixFromDepth(depth);
        return path.resolve(pathPrefix);
      }
    }

    return null; // No monorepo root found
  });

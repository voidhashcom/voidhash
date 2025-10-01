import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';

export const detectPackageManager = (pathPrefix = './') =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;

    // npm
    const packageLockPath = path.resolve(pathPrefix, 'package-lock.json');
    const packageLockExists = yield* fs.exists(packageLockPath);
    if (packageLockExists) {
      return 'npm';
    }

    // yarn
    const yarnLockPath = path.resolve(pathPrefix, 'yarn.lock');
    const yarnLockExists = yield* fs.exists(yarnLockPath);
    if (yarnLockExists) {
      return 'yarn';
    }

    // pnpm
    const pnpmLockPath = path.resolve(pathPrefix, 'pnpm-lock.yaml');
    const pnpmLockExists = yield* fs.exists(pnpmLockPath);
    if (pnpmLockExists) {
      return 'pnpm';
    }

    // bun
    const bunLockPath = path.resolve(pathPrefix, 'bun.lockb');
    const bunLockExists = yield* fs.exists(bunLockPath);
    if (bunLockExists) {
      return 'bun';
    }

    return null;
  });

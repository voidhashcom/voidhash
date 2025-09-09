import { Context, Effect, type Schema } from 'effect';
import { detectSrcLanguage } from './language';
import { detectMonorepoRootPath } from './monorepo';
import { loadPackageJson, type PackageJsonSchema } from './package-json';
import { detectPackageManager } from './package-manager';
import type { PackageManager, SourceCodeLanguage } from './types';
import { checkIsExpoProject, retrieveSrcDir } from './utils';

export type SourceCodeDetailsType = {
  language: SourceCodeLanguage;
  packageManager: PackageManager;
  srcDir: string;
  isExpoProject: boolean;
  monorepoRootPath: string | null;
  packageJson: Schema.Schema.Type<typeof PackageJsonSchema>;
};

export class SourceCodeDetails extends Context.Tag('app/SourceCodeDetails')<
  SourceCodeDetails,
  SourceCodeDetailsType
>() {
  static readonly provide =
    (details: SourceCodeDetailsType) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.provideService(SourceCodeDetails, details)(effect);
}

/**
 * Retrieves details about the source code environment, including language, package manager,
 * source directory, Expo project status, monorepo root path, and package.json contents.
 */
export const retrieveSourceCodeDetails = () => {
  return Effect.gen(function* () {
    const [packageJson, monorepoRootPath, language, srcDir] = yield* Effect.all(
      [
        loadPackageJson(),
        detectMonorepoRootPath(),
        detectSrcLanguage(),
        retrieveSrcDir()
      ],
      {
        concurrency: 'unbounded'
      }
    );

    const packageManager = yield* detectPackageManager(
      monorepoRootPath ?? './'
    );
    const isExpoProject = checkIsExpoProject(packageJson);

    return {
      language,
      packageManager,
      isExpoProject,
      srcDir,
      monorepoRootPath,
      packageJson
    };
  });
};

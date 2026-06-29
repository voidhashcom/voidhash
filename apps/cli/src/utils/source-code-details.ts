import { Effect, Context } from "effect";

import type { PackageJsonSchema } from "../domain/schema/package-json";
import { SourceCode } from "../domain/services/source-code";
import type { PackageManager, SourceCodeLanguage } from "../domain/types";
import { checkIsExpoProject } from "./source-code";

export interface SourceCodeDetailsType {
  language: SourceCodeLanguage;
  packageManager: PackageManager;
  srcDir: string;
  isExpoProject: boolean;
  monorepoRootPath: string | null;
  packageJson: typeof PackageJsonSchema.Type;
}

export class SourceCodeDetails extends Context.Service<SourceCodeDetails, SourceCodeDetailsType>()("app/SourceCodeDetails") {
  static readonly provide =
    (details: SourceCodeDetailsType) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.provideService(SourceCodeDetails, details)(effect);
}

/**
 * Retrieves details about the source code environment, including language, package manager,
 * source directory, Expo project status, monorepo root path, and package.json contents.
 */
export const retrieveSourceCodeDetails = () =>
  Effect.gen(function* retrieveSourceCodeDetails() {
    const sourceCode = yield* SourceCode;
    const [packageJson, monorepoRootPath, language, srcDir] = yield* Effect.all(
      [
        sourceCode.loadPackageJson(),
        sourceCode.detectMonorepoRootPath(),
        sourceCode.detectSrcLanguage(),
        sourceCode.retrieveSrcDir(),
      ],
      {
        concurrency: "unbounded",
      }
    );

    const packageManager = yield* sourceCode.detectPackageManager(
      monorepoRootPath ?? "./"
    );
    const isExpoProject = checkIsExpoProject(packageJson);

    return {
      isExpoProject,
      language,
      monorepoRootPath,
      packageJson,
      packageManager,
      srcDir,
    };
  });

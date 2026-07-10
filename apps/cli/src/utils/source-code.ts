import type { PackageJsonSchema } from "../domain/schema/package-json";

/**
 * Returns a relative path prefix based on the given directory depth.
 *
 * @param depth - The number of directory levels to go up.
 * @returns The relative path prefix (e.g., './' for 0, '../' for 1, etc.).
 */
export const relativePathPrefixFromDepth = (depth: number) =>
  depth === 0 ? "./" : `${"../".repeat(depth)}`;

/**
 * Checks if the project is an Expo project.
 *
 * @param packageJson - The package.json contents.
 * @returns True if the project is an Expo project, false otherwise.
 */
export const checkIsExpoProject = (packageJson: typeof PackageJsonSchema.Type) =>
  packageJson.dependencies?.expo !== undefined;

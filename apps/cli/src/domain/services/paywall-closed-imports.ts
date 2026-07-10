/**
 * Closed-import enforcement for `.voidhash` sources. Paywalls and components
 * may only import the paywalls SDK, React's runtime entries, and each other —
 * anything else (react-dom, lodash, app code outside `.voidhash`, …) fails the
 * build with an error naming the offending import.
 */
import { realpathSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";

import type * as esbuild from "esbuild";

/** Bare specifiers `.voidhash` sources may import. */
export const ALLOWED_BARE_IMPORTS: ReadonlyArray<string> = [
  "@voidhash/paywalls",
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
];

const PAYWALLS_PACKAGE = "@voidhash/paywalls";
/** The Node-only tree renderer never belongs in a shipped bundle. */
const FORBIDDEN_PAYWALLS_SUBPATH = `${PAYWALLS_PACKAGE}/tree`;

/** Resolves symlinks (macOS tmp dirs, pnpm) so containment checks compare real paths. */
const toRealPath = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

const isPathWithin = (parent: string, child: string): boolean => {
  const parentPath = toRealPath(parent);
  const childPath = toRealPath(child);
  return childPath === parentPath || childPath.startsWith(parentPath + sep);
};

const isAllowedBareImport = (specifier: string): boolean => {
  if (ALLOWED_BARE_IMPORTS.includes(specifier)) {
    return true;
  }
  // Any @voidhash/paywalls subpath except ./tree (dom, panel, …).
  return specifier.startsWith(`${PAYWALLS_PACKAGE}/`) && specifier !== FORBIDDEN_PAYWALLS_SUBPATH;
};

const disallowedMessage = (specifier: string, importer: string): string =>
  `Import "${specifier}" (in ${importer}) is not allowed in .voidhash sources. ` +
  `Allowed imports: ${ALLOWED_BARE_IMPORTS.join(", ")} ` +
  `(any "@voidhash/paywalls/*" subpath except "@voidhash/paywalls/tree"), ` +
  "plus relative imports within .voidhash.";

/**
 * An esbuild plugin that rejects any import from a `.voidhash` source file
 * other than:
 *
 * - `@voidhash/paywalls` and its subpaths (except the Node-only `./tree`),
 * - `react`, `react/jsx-runtime`, `react/jsx-dev-runtime`,
 * - relative/absolute imports that stay within `voidhashDir` (components
 *   importing components is allowed in P1 — they are bundled together).
 *
 * Imports made by `node_modules` code (e.g. the SDK importing `react-dom`
 * internally) are not constrained — only user-authored sources are.
 *
 * @param voidhashDir Absolute path to the project's `.voidhash` directory.
 */
export const closedImportsPlugin = (voidhashDir: string): esbuild.Plugin => ({
  name: "voidhash-closed-imports",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === "entry-point") {
        return null;
      }
      // Only user-authored sources are constrained. Synthetic stdin entries
      // (non-absolute importer) count as user sources.
      const fromUserSource = !isAbsolute(args.importer) || isPathWithin(voidhashDir, args.importer);
      if (!fromUserSource) {
        return null;
      }

      const specifier = args.path;

      if (specifier.startsWith(".")) {
        const target = resolve(args.resolveDir, specifier);
        if (!isPathWithin(voidhashDir, target)) {
          return {
            errors: [
              {
                text:
                  `Import "${specifier}" (in ${args.importer}) escapes the ` +
                  ".voidhash directory. Paywall sources may only import files " +
                  "within .voidhash.",
              },
            ],
          };
        }
        return null;
      }

      if (isAbsolute(specifier)) {
        return isPathWithin(voidhashDir, specifier)
          ? null
          : {
              errors: [{ text: disallowedMessage(specifier, args.importer) }],
            };
      }

      if (isAllowedBareImport(specifier)) {
        return null;
      }

      return {
        errors: [{ text: disallowedMessage(specifier, args.importer) }],
      };
    });
  },
});

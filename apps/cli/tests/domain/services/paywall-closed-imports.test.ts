import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import * as esbuild from "esbuild";
import { describe, expect, it } from "vitest";

import { closedImportsPlugin } from "../../../src/domain/services/paywall-closed-imports";

/** Bare modules marked external so "allowed" imports need no node_modules. */
const EXTERNALS = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@voidhash/paywalls",
  "@voidhash/paywalls/*",
];

interface Fixture {
  readonly projectRoot: string;
  readonly voidhashDir: string;
}

const writeSource = (
  projectRoot: string,
  relPath: string,
  contents: string,
): Effect.Effect<string, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* writeSource() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const abs = path.join(projectRoot, relPath);
    yield* fs.makeDirectory(path.dirname(abs), { recursive: true });
    yield* fs.writeFileString(abs, contents);
    return abs;
  }).pipe(Effect.orDie);

/** The esbuild error texts of a failed build ([] when it was not a build failure). */
const esbuildErrorTexts = (cause: unknown): Array<string> => {
  if (typeof cause !== "object" || cause === null || !("errors" in cause)) return [];
  const errors = cause.errors;
  if (!Array.isArray(errors)) return [];
  return errors.map((error: esbuild.Message) => error.text);
};

/** Bundles `entry` with the plugin; returns esbuild error texts ([] = ok). */
const buildErrors = (
  voidhashDir: string,
  entry: string,
  options: esbuild.BuildOptions = {},
): Effect.Effect<Array<string>> =>
  Effect.tryPromise({
    try: () =>
      esbuild.build({
        bundle: true,
        external: EXTERNALS,
        format: "esm",
        logLevel: "silent",
        plugins: [closedImportsPlugin(voidhashDir)],
        write: false,
        ...options,
        entryPoints: [entry],
      }),
    catch: esbuildErrorTexts,
  }).pipe(Effect.match({ onFailure: (texts) => texts, onSuccess: () => [] }));

/**
 * Runs `use` against a fresh temporary project holding the shared sources the
 * suite bundles against, removed again once the test finishes — the fixture
 * lifecycle `beforeAll`/`afterAll` used to own.
 */
const withFixture = <A, E>(
  use: (fixture: Fixture) => Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>,
): Promise<A> =>
  Effect.gen(function* withFixture() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const projectRoot = yield* fs
      .makeTempDirectory({ prefix: "voidhash-closed-imports-" })
      .pipe(Effect.orDie);
    const voidhashDir = path.join(projectRoot, ".voidhash");

    return yield* Effect.gen(function* runFixture() {
      yield* writeSource(projectRoot, ".voidhash/components/helper.ts", "export const helper = 1;\n");
      yield* fs
        .writeFileString(path.join(projectRoot, "app-code.ts"), "export const y = 1;\n")
        .pipe(Effect.orDie);
      return yield* use({ projectRoot, voidhashDir });
    }).pipe(
      Effect.ensuring(fs.remove(projectRoot, { force: true, recursive: true }).pipe(Effect.orDie)),
    );
  }).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

describe("closedImportsPlugin", () => {
  it("allows the allowlist plus relative imports within .voidhash", () =>
    withFixture(({ projectRoot, voidhashDir }) =>
      Effect.gen(function* allowsAllowlist() {
        const entry = yield* writeSource(
          projectRoot,
          ".voidhash/components/allowed.ts",
          [
            'import "react";',
            'import "react/jsx-runtime";',
            'import "react/jsx-dev-runtime";',
            'import "@voidhash/paywalls";',
            'import "@voidhash/paywalls/dom";',
            'import "@voidhash/paywalls/panel";',
            'import { helper } from "./helper";',
            "export const ok = helper;",
          ].join("\n"),
        );

        expect(yield* buildErrors(voidhashDir, entry)).toEqual([]);
      }),
    ));

  it("rejects react-dom, naming the importing file", () =>
    withFixture(({ projectRoot, voidhashDir }) =>
      Effect.gen(function* rejectsReactDom() {
        const entry = yield* writeSource(
          projectRoot,
          ".voidhash/components/uses-react-dom.ts",
          'import "react-dom";\nexport {};\n',
        );

        const errors = yield* buildErrors(voidhashDir, entry, {
          external: [...EXTERNALS, "react-dom"],
        });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('"react-dom"');
        expect(errors[0]).toContain("uses-react-dom.ts");
      }),
    ));

  it("rejects arbitrary packages", () =>
    withFixture(({ projectRoot, voidhashDir }) =>
      Effect.gen(function* rejectsArbitraryPackages() {
        const entry = yield* writeSource(
          projectRoot,
          ".voidhash/components/uses-lodash.ts",
          'import "lodash";\nexport {};\n',
        );

        const errors = yield* buildErrors(voidhashDir, entry);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('"lodash"');
      }),
    ));

  it("rejects the Node-only @voidhash/paywalls/tree entry", () =>
    withFixture(({ projectRoot, voidhashDir }) =>
      Effect.gen(function* rejectsTreeEntry() {
        const entry = yield* writeSource(
          projectRoot,
          ".voidhash/components/uses-tree.ts",
          'import "@voidhash/paywalls/tree";\nexport {};\n',
        );

        const errors = yield* buildErrors(voidhashDir, entry);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('"@voidhash/paywalls/tree"');
      }),
    ));

  it("rejects relative imports escaping .voidhash", () =>
    withFixture(({ projectRoot, voidhashDir }) =>
      Effect.gen(function* rejectsEscapingImports() {
        const entry = yield* writeSource(
          projectRoot,
          ".voidhash/components/escapes.ts",
          'import "../../app-code";\nexport {};\n',
        );

        const errors = yield* buildErrors(voidhashDir, entry);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("escapes the .voidhash directory");
      }),
    ));

  it("does not constrain imports made outside .voidhash (node_modules)", () =>
    withFixture(({ projectRoot, voidhashDir }) =>
      Effect.gen(function* allowsOutsideVoidhash() {
        const path = yield* Path.Path;
        const entry = path.join(projectRoot, "vendor-entry.ts");
        yield* writeSource(projectRoot, "vendor-entry.ts", 'import "react-dom";\nexport {};\n');

        expect(
          yield* buildErrors(voidhashDir, entry, { external: [...EXTERNALS, "react-dom"] }),
        ).toEqual([]);
      }),
    ));
});

import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "vitest";

import {
  PAYWALL_ASSET_EXTENSIONS,
  PaywallTypecheckError,
  typecheckPaywallSources,
} from "../../../src/domain/services/paywall-typecheck";

const compilerTestTimeout = 60_000;

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

/**
 * Runs `use` against a fresh temporary project root, removed again once the
 * test finishes — the fixture lifecycle `beforeAll`/`afterAll` used to own.
 */
const withProjectRoot = <A, E>(
  use: (projectRoot: string) => Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>,
): Promise<A> =>
  Effect.gen(function* withProjectRoot() {
    const fs = yield* FileSystem.FileSystem;
    const projectRoot = yield* fs.makeTempDirectory({ prefix: "voidhash-typecheck-" }).pipe(
      Effect.orDie,
    );
    return yield* use(projectRoot).pipe(
      Effect.ensuring(fs.remove(projectRoot, { force: true, recursive: true }).pipe(Effect.orDie)),
    );
  }).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

describe("typecheckPaywallSources", () => {
  it(
    "passes a source importing a .png via the injected asset declarations",
    () =>
      withProjectRoot((projectRoot) =>
        Effect.gen(function* passesAssetImport() {
          const entry = yield* writeSource(
            projectRoot,
            ".voidhash/paywalls/with-asset.ts",
            ['import hero from "./hero.png";', "export const heroUrl: string = hero;", ""].join(
              "\n",
            ),
          );

          const result = yield* typecheckPaywallSources({ files: [entry], projectRoot });
          expect(result).toBeUndefined();
        }),
      ),
    compilerTestTimeout,
  );

  it(
    "covers every esbuild-supported asset extension",
    () =>
      withProjectRoot((projectRoot) =>
        Effect.gen(function* coversEveryExtension() {
          const imports = PAYWALL_ASSET_EXTENSIONS.map(
            (ext, i) => `import asset${i} from "./asset.${ext}";`,
          );
          const uses = PAYWALL_ASSET_EXTENSIONS.map(
            (_, i) => `export const url${i}: string = asset${i};`,
          );
          const entry = yield* writeSource(
            projectRoot,
            ".voidhash/paywalls/all-assets.ts",
            [...imports, ...uses, ""].join("\n"),
          );

          const result = yield* typecheckPaywallSources({ files: [entry], projectRoot });
          expect(result).toBeUndefined();
        }),
      ),
    compilerTestTimeout,
  );

  it(
    "still fails a genuinely type-broken source",
    () =>
      withProjectRoot((projectRoot) =>
        Effect.gen(function* failsBrokenSource() {
          const entry = yield* writeSource(
            projectRoot,
            ".voidhash/paywalls/broken.ts",
            ['import hero from "./hero.png";', "export const broken: number = hero;", ""].join(
              "\n",
            ),
          );

          const error = yield* Effect.flip(
            typecheckPaywallSources({ files: [entry], projectRoot }),
          );
          expect(error).toBeInstanceOf(PaywallTypecheckError);
          expect(error.message).toContain("broken.ts");
        }),
      ),
    compilerTestTimeout,
  );

  it(
    "still fails an import of an undeclared module kind",
    () =>
      withProjectRoot((projectRoot) =>
        Effect.gen(function* failsUndeclaredModule() {
          const entry = yield* writeSource(
            projectRoot,
            ".voidhash/paywalls/bad-import.ts",
            ['import data from "./data.bin";', "export const d = data;", ""].join("\n"),
          );

          const error = yield* Effect.flip(
            typecheckPaywallSources({ files: [entry], projectRoot }),
          );
          expect(error).toBeInstanceOf(PaywallTypecheckError);
        }),
      ),
    compilerTestTimeout,
  );
});
